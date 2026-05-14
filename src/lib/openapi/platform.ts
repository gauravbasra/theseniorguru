import crypto from "node:crypto";
import type {
  ApiAuditEventRecord,
  ApiAuthenticationResult,
  ApiClientRecord,
  ApiClientScope,
  ApiKeyRecord,
  ApiUsageAnalyticsClient,
  ApiUsageAnalyticsSummary,
  CreateApiClientInput,
  CreateApiKeyInput,
  CreatedApiKeyRecord,
  CreatedWebhookSubscriptionRecord,
  CreateWebhookSubscriptionInput,
  EnqueueWebhookDeliveryInput,
  ProcessWebhookDeliveriesInput,
  ProcessWebhookDeliveriesResult,
  ReplayWebhookDeliveriesInput,
  ReplayWebhookDeliveriesResult,
  RetryWebhookDeliveriesInput,
  RetryWebhookDeliveriesResult,
  WebhookRetrySchedulerInput,
  WebhookRetrySchedulerResult,
  WebhookDeliveryAttemptRecord,
  WebhookDeliveryRecord,
  WebhookEventType,
  WebhookReplayEvidenceExport,
  WebhookReplayEvidenceExportRow,
  WebhookSigningGuide,
  WebhookSignatureVerificationInput,
  WebhookSignatureVerificationResult,
  WebhookSubscriptionRecord
} from "@/lib/domain/open-api";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const allowedWebhookEvents: WebhookEventType[] = [
  "provider.claimed",
  "provider.updated",
  "provider.contact.created",
  "review.created",
  "review.response.published",
  "event.created",
  "event.rsvp.created",
  "campaign.published",
  "campaign.metric.updated",
  "ad.impression.recorded",
  "ad.click.recorded",
  "community.post.created"
];

const allowedApiScopes: ApiClientScope[] = [
  "providers:read",
  "events:read",
  "reviews:read",
  "campaigns:read",
  "ads:read",
  "usage:read",
  "claims:write",
  "webhooks:write"
];

const seedApiClients: ApiClientRecord[] = [];
const seedApiKeys: ApiKeyRecord[] = [];
const seedApiKeyHashes = new Map<string, string>();
const seedWebhookSubscriptions: WebhookSubscriptionRecord[] = [];
const seedWebhookDeliveries: WebhookDeliveryRecord[] = [];
const seedWebhookDeliveryAttempts: WebhookDeliveryAttemptRecord[] = [];
const seedApiAuditEvents: ApiAuditEventRecord[] = [];
const seedRateCounters = new Map<string, { windowStart: number; count: number }>();
const defaultApiUsageRetentionDays = 730;

type InternalWebhookSubscription = WebhookSubscriptionRecord & {
  signingSecret?: string;
  signingSecretHash?: string;
  signingSecretCiphertext?: string;
};

type InternalWebhookDelivery = WebhookDeliveryRecord & {
  subscription?: InternalWebhookSubscription;
};

type ApiKeyLookupResult = {
  client: ApiClientRecord;
  apiKeyId: string;
};

function previewSecret(secret: string) {
  return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function getWebhookSigningEncryptionMaterial() {
  return (
    process.env.WEBHOOK_SIGNING_ENCRYPTION_KEY ??
    process.env.ADMIN_SESSION_SECRET ??
    process.env.ADMIN_ACCESS_CODE ??
    (process.env.NODE_ENV === "production" ? undefined : "local-webhook-signing-secret")
  );
}

function getWebhookSigningEncryptionKey() {
  const material = getWebhookSigningEncryptionMaterial();

  if (!material) {
    return null;
  }

  return crypto.createHash("sha256").update(material).digest();
}

function encryptWebhookSigningSecret(secret: string) {
  const key = getWebhookSigningEncryptionKey();

  if (!key) {
    throw new Error("WEBHOOK_SIGNING_ENCRYPTION_KEY or ADMIN_SESSION_SECRET is required for webhook delivery signing");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decryptWebhookSigningSecret(ciphertext?: string) {
  if (!ciphertext) {
    return null;
  }

  const key = getWebhookSigningEncryptionKey();

  if (!key) {
    return null;
  }

  const [version, encodedIv, encodedTag, encodedCiphertext] = ciphertext.split(".");

  if (version !== "v1" || !encodedIv || !encodedTag || !encodedCiphertext) {
    return null;
  }

  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(encodedIv, "base64url"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function createSecret(prefix: string) {
  return `${prefix}_${crypto.randomBytes(24).toString("base64url")}`;
}

function mapClient(row: Record<string, unknown>): ApiClientRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    ownerType: row.owner_type as ApiClientRecord["ownerType"],
    ownerId: row.owner_id ? String(row.owner_id) : undefined,
    scopes: Array.isArray(row.scopes)
      ? (row.scopes.map(String).filter((scope) => allowedApiScopes.includes(scope as ApiClientScope)) as ApiClientScope[])
      : [],
    sandboxMode: Boolean(row.sandbox_mode),
    rateLimitPerMinute: Number(row.rate_limit_per_minute ?? 60),
    status: row.status as ApiClientRecord["status"],
    createdAt: String(row.created_at)
  };
}

function mapApiKey(row: Record<string, unknown>): ApiKeyRecord {
  return {
    id: String(row.id),
    apiClientId: String(row.api_client_id),
    name: String(row.name),
    keyPreview: String(row.key_preview),
    status: row.status as ApiKeyRecord["status"],
    createdAt: String(row.created_at),
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    lastUsedAt: row.last_used_at ? String(row.last_used_at) : undefined
  };
}

function redactApiKey(record: ApiKeyRecord | CreatedApiKeyRecord): ApiKeyRecord {
  return {
    id: record.id,
    apiClientId: record.apiClientId,
    name: record.name,
    keyPreview: record.keyPreview,
    status: record.status,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    lastUsedAt: record.lastUsedAt
  };
}

function mapWebhookSubscription(row: Record<string, unknown>): WebhookSubscriptionRecord {
  return {
    id: String(row.id),
    apiClientId: String(row.api_client_id),
    targetUrl: String(row.target_url),
    eventTypes: Array.isArray(row.event_types) ? (row.event_types.map(String) as WebhookEventType[]) : [],
    signingSecretPreview: String(row.signing_secret_preview),
    status: row.status as WebhookSubscriptionRecord["status"],
    createdAt: String(row.created_at)
  };
}

function mapInternalWebhookSubscription(row: Record<string, unknown>): InternalWebhookSubscription {
  const signingSecretCiphertext = row.signing_secret_ciphertext ? String(row.signing_secret_ciphertext) : undefined;

  return {
    ...mapWebhookSubscription(row),
    signingSecretHash: row.signing_secret_hash ? String(row.signing_secret_hash) : undefined,
    signingSecretCiphertext,
    signingSecret: decryptWebhookSigningSecret(signingSecretCiphertext) ?? undefined
  };
}

function mapWebhookDelivery(row: Record<string, unknown>): WebhookDeliveryRecord {
  return {
    id: String(row.id),
    subscriptionId: String(row.subscription_id),
    eventType: row.event_type as WebhookEventType,
    subjectId: row.subject_id ? String(row.subject_id) : undefined,
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
    status: row.status as WebhookDeliveryRecord["status"],
    attempts: Number(row.attempts ?? 0),
    lastError: row.last_error ? String(row.last_error) : undefined,
    createdAt: String(row.created_at),
    deliveredAt: row.delivered_at ? String(row.delivered_at) : undefined
  };
}

function mapInternalWebhookDelivery(row: Record<string, unknown>): InternalWebhookDelivery {
  const subscriptionRow = Array.isArray(row.webhook_subscriptions)
    ? row.webhook_subscriptions[0]
    : row.webhook_subscriptions;

  return {
    ...mapWebhookDelivery(row),
    subscription:
      subscriptionRow && typeof subscriptionRow === "object"
        ? mapInternalWebhookSubscription(subscriptionRow as Record<string, unknown>)
        : undefined
  };
}

function mapWebhookDeliveryAttempt(row: Record<string, unknown>): WebhookDeliveryAttemptRecord {
  return {
    id: String(row.id),
    deliveryId: String(row.delivery_id),
    targetUrl: String(row.target_url),
    status: row.status as WebhookDeliveryAttemptRecord["status"],
    statusCode: row.status_code ? Number(row.status_code) : undefined,
    error: row.error ? String(row.error) : undefined,
    signaturePreview: row.signature_preview ? String(row.signature_preview) : undefined,
    createdAt: String(row.created_at)
  };
}

function mapApiAuditEvent(row: Record<string, unknown>): ApiAuditEventRecord {
  return {
    id: String(row.id),
    apiClientId: row.api_client_id ? String(row.api_client_id) : undefined,
    eventType: String(row.event_type),
    subjectType: row.subject_type ? String(row.subject_type) : undefined,
    subjectId: row.subject_id ? String(row.subject_id) : undefined,
    status: row.status as ApiAuditEventRecord["status"],
    requestMetadata:
      row.request_metadata && typeof row.request_metadata === "object"
        ? (row.request_metadata as Record<string, unknown>)
        : undefined,
    createdAt: String(row.created_at)
  };
}

function getRequestApiKey(request: Request) {
  const explicit = request.headers.get("x-senior-guru-api-key");
  const authorization = request.headers.get("authorization");

  if (explicit) {
    return explicit.trim();
  }

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return null;
}

function nowMinusOneMinuteIso() {
  return new Date(Date.now() - 60_000).toISOString();
}

async function recordApiAuditEvent(input: {
  apiClientId?: string;
  eventType: string;
  subjectType?: string;
  subjectId?: string;
  status: ApiAuditEventRecord["status"];
  requestMetadata?: Record<string, unknown>;
}) {
  const createdAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    seedApiAuditEvents.unshift({
      id: `api-audit-${crypto.randomUUID()}`,
      apiClientId: input.apiClientId,
      eventType: input.eventType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      status: input.status,
      requestMetadata: input.requestMetadata,
      createdAt
    });
    return;
  }

  const { error } = await supabase.from("api_audit_events").insert({
    api_client_id: input.apiClientId,
    event_type: input.eventType,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    status: input.status,
    request_metadata: input.requestMetadata ?? {}
  });

  if (error) {
    throw new Error(`API audit event creation failed: ${error.message}`);
  }
}

async function findClientByApiKey(secret: string): Promise<ApiKeyLookupResult | null> {
  const secretHash = sha256(secret);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const apiKeyId = seedApiKeyHashes.get(secretHash);
    const apiKey = apiKeyId ? seedApiKeys.find((key) => key.id === apiKeyId && key.status === "active") : null;

    if (!apiKey) {
      return null;
    }

    const client = seedApiClients.find((record) => record.id === apiKey.apiClientId && record.status === "active") ?? null;

    if (!client) {
      return null;
    }

    apiKey.lastUsedAt = new Date().toISOString();
    return { client, apiKeyId: apiKey.id };
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("*, api_clients(*)")
    .eq("key_hash", secretHash)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`API key lookup failed: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  if (data.expires_at && new Date(String(data.expires_at)).getTime() < Date.now()) {
    return null;
  }

  const clientRow = Array.isArray(data.api_clients) ? data.api_clients[0] : data.api_clients;

  if (!clientRow || clientRow.status !== "active") {
    return null;
  }

  const now = new Date().toISOString();
  await supabase.from("api_keys").update({ last_used_at: now }).eq("id", data.id);

  return { client: mapClient(clientRow), apiKeyId: String(data.id) };
}

async function isRateLimited(client: ApiClientRecord) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const windowKey = client.id;
    const existing = seedRateCounters.get(windowKey);
    const now = Date.now();

    if (!existing || now - existing.windowStart >= 60_000) {
      seedRateCounters.set(windowKey, { windowStart: now, count: 1 });
      return false;
    }

    existing.count += 1;
    return existing.count > client.rateLimitPerMinute;
  }

  const { count, error } = await supabase
    .from("api_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("api_client_id", client.id)
    .gte("created_at", nowMinusOneMinuteIso());

  if (error) {
    throw new Error(`API rate limit query failed: ${error.message}`);
  }

  return (count ?? 0) >= client.rateLimitPerMinute;
}

function validateWebhookInput(input: CreateWebhookSubscriptionInput) {
  let parsed: URL;

  try {
    parsed = new URL(input.targetUrl);
  } catch {
    throw new Error("Webhook targetUrl must be a valid HTTPS URL");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Webhook targetUrl must use HTTPS");
  }

  if (!input.eventTypes.length) {
    throw new Error("At least one webhook event type is required");
  }

  const unsupported = input.eventTypes.filter((eventType) => !allowedWebhookEvents.includes(eventType));

  if (unsupported.length) {
    throw new Error(`Unsupported webhook event type: ${unsupported.join(", ")}`);
  }
}

function signWebhookPayload(secretMaterial: string, timestamp: number, body: string) {
  const digest = crypto.createHmac("sha256", secretMaterial).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${digest}`;
}

function previewSignature(signature: string) {
  return `${signature.slice(0, 24)}...${signature.slice(-8)}`;
}

export function getWebhookSigningGuide(): WebhookSigningGuide {
  const timestamp = 1778792400;
  const payload = {
    id: "webhook-delivery-example",
    eventType: "provider.updated",
    subjectId: "provider-example",
    payload: {
      providerId: "provider-example",
      status: "updated"
    },
    createdAt: "2026-05-14T21:00:00.000Z"
  };
  const rawBody = JSON.stringify(payload);
  const secret = "whsec_example_do_not_use";
  const signature = signWebhookPayload(secret, timestamp, rawBody);

  return {
    generatedAt: new Date().toISOString(),
    version: "v1",
    algorithm: "HMAC-SHA256",
    signatureHeader: "x-senior-guru-signature",
    eventHeader: "x-senior-guru-event",
    userAgent: "TheSeniorGuru-Webhooks/0.1",
    signedContent: "timestamp.rawBody",
    toleranceSeconds: 300,
    supportedEvents: allowedWebhookEvents,
    verificationSteps: [
      "Read the exact raw request body before JSON parsing.",
      "Parse x-senior-guru-signature into t and v1 values.",
      "Reject requests when the timestamp is outside the configured tolerance window.",
      "Compute HMAC-SHA256 with the webhook signing secret over `${t}.${rawBody}`.",
      "Compare the computed v1 digest to the supplied v1 digest using a constant-time comparison.",
      "Use the webhook delivery id as an idempotency key before writing downstream changes."
    ],
    sample: {
      secret,
      timestamp,
      payload,
      rawBody,
      signature,
      headers: {
        "content-type": "application/json",
        "user-agent": "TheSeniorGuru-Webhooks/0.1",
        "x-senior-guru-event": "provider.updated",
        "x-senior-guru-signature": signature
      }
    },
    failureHandling: {
      retryableStatuses: ["failed", "blocked"],
      replayableStatuses: ["failed", "blocked", "delivered"],
      duplicateProtection: "Store the webhook delivery id and ignore a delivery when it has already been processed."
    }
  };
}

function extractWebhookSignatureParts(signature: string) {
  const parts = Object.fromEntries(
    signature
      .split(",")
      .map((part) => part.split("="))
      .filter(([key, value]) => key && value)
      .map(([key, value]) => [key.trim(), value.trim()])
  );

  return {
    timestamp: parts.t ? Number(parts.t) : undefined,
    digest: parts.v1
  };
}

function secureCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export async function listApiClients(): Promise<ApiClientRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedApiClients;
  }

  const { data, error } = await supabase.from("api_clients").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`API clients query failed: ${error.message}`);
  }

  return (data ?? []).map(mapClient);
}

export async function createApiClient(input: CreateApiClientInput): Promise<ApiClientRecord> {
  const policy = await runPolicyCheck({
    subjectType: "api_client",
    actionKey: "create_api_client",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "API client blocked by policy");
  }

  const record: ApiClientRecord = {
    id: `api-client-${crypto.randomUUID()}`,
    name: input.name,
    ownerType: input.ownerType ?? "partner",
    ownerId: input.ownerId,
    scopes: input.scopes ?? ["providers:read", "events:read", "usage:read"],
    sandboxMode: input.sandboxMode ?? true,
    rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
    status: "active",
    createdAt: new Date().toISOString()
  };

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    seedApiClients.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("api_clients")
    .insert({
      name: record.name,
      owner_type: record.ownerType,
      owner_id: record.ownerId,
      scopes: record.scopes,
      sandbox_mode: record.sandboxMode,
      rate_limit_per_minute: record.rateLimitPerMinute,
      status: record.status
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`API client creation failed: ${error.message}`);
  }

  return mapClient(data);
}

export async function createApiKey(input: CreateApiKeyInput): Promise<CreatedApiKeyRecord> {
  const secret = createSecret("tsg_live");
  const secretHash = sha256(secret);
  const keyPreview = previewSecret(secret);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const record: CreatedApiKeyRecord = {
      id: `api-key-${crypto.randomUUID()}`,
      apiClientId: input.apiClientId,
      name: input.name,
      keyPreview,
      secret,
      status: "active",
      createdAt: new Date().toISOString(),
      expiresAt: input.expiresAt
    };
    seedApiKeys.unshift(record);
    seedApiKeyHashes.set(secretHash, record.id);
    return record;
  }

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      api_client_id: input.apiClientId,
      name: input.name,
      key_hash: secretHash,
      key_preview: keyPreview,
      expires_at: input.expiresAt
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`API key creation failed: ${error.message}`);
  }

  return { ...mapApiKey(data), secret };
}

export async function listApiKeys(apiClientId: string): Promise<ApiKeyRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedApiKeys.filter((key) => key.apiClientId === apiClientId).map(redactApiKey);
  }

  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("api_client_id", apiClientId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`API keys query failed: ${error.message}`);
  }

  return (data ?? []).map(mapApiKey);
}

export async function revokeApiKey(input: {
  apiClientId: string;
  apiKeyId: string;
  reason?: string;
  actorId?: string;
}): Promise<ApiKeyRecord> {
  const policy = await runPolicyCheck({
    subjectType: "api_key",
    subjectId: input.apiKeyId,
    actionKey: "revoke_api_key",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "API key revocation blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const key = seedApiKeys.find((record) => record.id === input.apiKeyId && record.apiClientId === input.apiClientId);

    if (!key) {
      throw new Error("API key not found for client");
    }

    key.status = "revoked";
    await recordApiAuditEvent({
      apiClientId: input.apiClientId,
      eventType: "api_key.revoked",
      subjectType: "api_key",
      subjectId: input.apiKeyId,
      status: "allowed",
      requestMetadata: { reason: input.reason, actorId: input.actorId }
    });

    return redactApiKey(key);
  }

  const { data, error } = await supabase
    .from("api_keys")
    .update({ status: "revoked" })
    .eq("id", input.apiKeyId)
    .eq("api_client_id", input.apiClientId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`API key revocation failed: ${error.message}`);
  }

  if (!data) {
    throw new Error("API key not found for client");
  }

  await recordApiAuditEvent({
    apiClientId: input.apiClientId,
    eventType: "api_key.revoked",
    subjectType: "api_key",
    subjectId: input.apiKeyId,
    status: "allowed",
    requestMetadata: { reason: input.reason, actorId: input.actorId }
  });

  return mapApiKey(data);
}

export async function listWebhookSubscriptions(apiClientId?: string): Promise<WebhookSubscriptionRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return apiClientId
      ? seedWebhookSubscriptions.filter((subscription) => subscription.apiClientId === apiClientId)
      : seedWebhookSubscriptions;
  }

  let query = supabase.from("webhook_subscriptions").select("*").order("created_at", { ascending: false });

  if (apiClientId) {
    query = query.eq("api_client_id", apiClientId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Webhook subscriptions query failed: ${error.message}`);
  }

  return (data ?? []).map(mapWebhookSubscription);
}

async function getInternalWebhookSubscription(subscriptionId: string): Promise<InternalWebhookSubscription | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return (seedWebhookSubscriptions as InternalWebhookSubscription[]).find((subscription) => subscription.id === subscriptionId) ?? null;
  }

  const { data, error } = await supabase
    .from("webhook_subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Webhook subscription query failed: ${error.message}`);
  }

  return data ? mapInternalWebhookSubscription(data) : null;
}

export async function createWebhookSubscription(
  input: CreateWebhookSubscriptionInput
): Promise<CreatedWebhookSubscriptionRecord> {
  validateWebhookInput(input);

  const policy = await runPolicyCheck({
    subjectType: "webhook_subscription",
    subjectId: input.apiClientId,
    actionKey: "create_webhook_subscription",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Webhook subscription blocked by policy");
  }

  const signingSecret = createSecret("whsec");
  const record: CreatedWebhookSubscriptionRecord = {
    id: `webhook-subscription-${crypto.randomUUID()}`,
    apiClientId: input.apiClientId,
    targetUrl: input.targetUrl,
    eventTypes: input.eventTypes,
    signingSecretPreview: previewSecret(signingSecret),
    signingSecret,
    status: "active",
    createdAt: new Date().toISOString()
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    seedWebhookSubscriptions.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("webhook_subscriptions")
    .insert({
      api_client_id: input.apiClientId,
      target_url: input.targetUrl,
      event_types: input.eventTypes,
      signing_secret_hash: sha256(signingSecret),
      signing_secret_ciphertext: encryptWebhookSigningSecret(signingSecret),
      signing_secret_preview: record.signingSecretPreview
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Webhook subscription creation failed: ${error.message}`);
  }

  return { ...mapWebhookSubscription(data), signingSecret };
}

export async function verifyWebhookSignature(input: WebhookSignatureVerificationInput): Promise<WebhookSignatureVerificationResult> {
  const toleranceSeconds = Math.max(30, Math.min(Number(input.toleranceSeconds ?? 300), 3600));
  const supplied = extractWebhookSignatureParts(input.signature);
  const timestamp = Number.isFinite(input.timestamp) ? Number(input.timestamp) : supplied.timestamp ?? 0;
  const timestampSkewSeconds = timestamp ? Math.abs(Math.floor(Date.now() / 1000) - timestamp) : Number.POSITIVE_INFINITY;
  const subscription = await getInternalWebhookSubscription(input.subscriptionId);
  const reasons: string[] = [];

  if (!subscription) {
    reasons.push("Webhook subscription was not found.");
  } else if (subscription.apiClientId !== input.apiClientId) {
    reasons.push("Webhook subscription does not belong to this API client.");
  } else if (subscription.status !== "active") {
    reasons.push("Webhook subscription is not active.");
  }

  if (!input.signature || !supplied.digest) {
    reasons.push("Signature must include a v1 digest.");
  }

  if (!timestamp) {
    reasons.push("Signature timestamp is missing or invalid.");
  } else if (timestampSkewSeconds > toleranceSeconds) {
    reasons.push("Signature timestamp is outside the allowed tolerance window.");
  }

  if (!input.payload) {
    reasons.push("Payload is required for signature verification.");
  }

  const signingSecret = subscription?.signingSecret;

  if (subscription && subscription.apiClientId === input.apiClientId && !signingSecret) {
    reasons.push("Webhook signing secret is unavailable or cannot be decrypted.");
  }

  let valid = false;

  if (!reasons.length && signingSecret && supplied.digest) {
    const expected = signWebhookPayload(signingSecret, timestamp, input.payload);
    const expectedDigest = extractWebhookSignatureParts(expected).digest;
    valid = Boolean(expectedDigest && secureCompare(expectedDigest, supplied.digest));

    if (!valid) {
      reasons.push("Signature digest does not match the expected payload signature.");
    }
  }

  await recordApiAuditEvent({
    apiClientId: input.apiClientId,
    eventType: "partner.webhook_signature.verified",
    subjectType: "webhook_subscription",
    subjectId: input.subscriptionId,
    status: valid ? "allowed" : "blocked",
    requestMetadata: {
      valid,
      timestamp,
      timestampSkewSeconds: Number.isFinite(timestampSkewSeconds) ? timestampSkewSeconds : undefined,
      toleranceSeconds,
      reasons
    }
  });

  return {
    valid,
    subscriptionId: input.subscriptionId,
    apiClientId: input.apiClientId,
    signaturePreview: input.signature ? previewSignature(input.signature) : undefined,
    timestamp,
    timestampSkewSeconds: Number.isFinite(timestampSkewSeconds) ? timestampSkewSeconds : 0,
    toleranceSeconds,
    eventTypes: subscription?.apiClientId === input.apiClientId ? subscription.eventTypes : [],
    reasons
  };
}

export async function listWebhookDeliveries(status?: WebhookDeliveryRecord["status"]): Promise<WebhookDeliveryRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return status ? seedWebhookDeliveries.filter((delivery) => delivery.status === status) : seedWebhookDeliveries;
  }

  let query = supabase.from("webhook_deliveries").select("*").order("created_at", { ascending: false }).limit(100);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Webhook deliveries query failed: ${error.message}`);
  }

  return (data ?? []).map(mapWebhookDelivery);
}

async function listWebhookDeliveryAttempts(deliveryIds: string[]): Promise<WebhookDeliveryAttemptRecord[]> {
  const ids = Array.from(new Set(deliveryIds.filter(Boolean)));

  if (!ids.length) {
    return [];
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedWebhookDeliveryAttempts.filter((attempt) => ids.includes(attempt.deliveryId));
  }

  const { data, error } = await supabase
    .from("webhook_delivery_attempts")
    .select("*")
    .in("delivery_id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Webhook delivery attempt query failed: ${error.message}`);
  }

  return (data ?? []).map(mapWebhookDeliveryAttempt);
}

export async function enqueueWebhookDeliveries(input: EnqueueWebhookDeliveryInput): Promise<WebhookDeliveryRecord[]> {
  const policy = await runPolicyCheck({
    subjectType: "webhook_delivery",
    subjectId: input.subjectId,
    actionKey: "enqueue_webhook_delivery",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Webhook delivery blocked by policy");
  }

  const subscriptions = (await listWebhookSubscriptions()).filter(
    (subscription) => subscription.status === "active" && subscription.eventTypes.includes(input.eventType)
  );

  const supabase = getSupabaseAdminClient();
  const rows = subscriptions.map((subscription) => ({
    subscription_id: subscription.id,
    event_type: input.eventType,
    subject_id: input.subjectId,
    payload: input.payload,
    status: "queued",
    attempts: 0
  }));

  if (!supabase) {
    const records = rows.map((row) => ({
      id: `webhook-delivery-${crypto.randomUUID()}`,
      subscriptionId: row.subscription_id,
      eventType: row.event_type,
      subjectId: row.subject_id,
      payload: row.payload,
      status: "queued" as const,
      attempts: 0,
      createdAt: new Date().toISOString()
    }));
    seedWebhookDeliveries.unshift(...records);
    return records;
  }

  if (!rows.length) {
    return [];
  }

  const { data, error } = await supabase.from("webhook_deliveries").insert(rows).select("*");

  if (error) {
    throw new Error(`Webhook delivery enqueue failed: ${error.message}`);
  }

  return (data ?? []).map(mapWebhookDelivery);
}

export async function retryWebhookDeliveries(
  input: RetryWebhookDeliveriesInput = {}
): Promise<RetryWebhookDeliveriesResult> {
  const retryableStatuses: WebhookDeliveryRecord["status"][] = ["failed", "blocked"];
  const status = input.status ?? "failed";
  const deliveryIds = Array.from(new Set(input.deliveryIds?.map((id) => String(id).trim()).filter(Boolean) ?? []));
  const requestedLimit = input.limit ?? (deliveryIds.length || 10);
  const limit = Math.max(1, Math.min(requestedLimit, 50));

  if (!retryableStatuses.includes(status)) {
    throw new Error("Only failed or blocked webhook deliveries can be retried");
  }

  const policy = await runPolicyCheck({
    subjectType: "webhook_delivery",
    actionKey: "retry_webhook_delivery",
    input: {
      deliveryIds,
      status,
      limit,
      reason: input.reason,
      actorId: input.actorId
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Webhook delivery retry blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const candidates = seedWebhookDeliveries
      .filter((delivery) => retryableStatuses.includes(delivery.status))
      .filter((delivery) => (deliveryIds.length ? deliveryIds.includes(delivery.id) : delivery.status === status))
      .slice(0, limit);

    for (const delivery of candidates) {
      delivery.status = "queued";
      delivery.lastError = undefined;
      delivery.deliveredAt = undefined;
    }

    await recordApiAuditEvent({
      eventType: "webhook_delivery.retried",
      subjectType: "webhook_delivery",
      subjectId: candidates.map((delivery) => delivery.id).join(",") || undefined,
      status: "allowed",
      requestMetadata: {
        reason: input.reason,
        actorId: input.actorId,
        previousStatus: status,
        requeued: candidates.length
      }
    });

    return {
      requeued: candidates.length,
      deliveryIds: candidates.map((delivery) => delivery.id),
      status: "queued"
    };
  }

  let selectedIds = deliveryIds;

  if (!selectedIds.length) {
    const { data: candidates, error: selectError } = await supabase
      .from("webhook_deliveries")
      .select("id")
      .eq("status", status)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (selectError) {
      throw new Error(`Webhook delivery retry selection failed: ${selectError.message}`);
    }

    selectedIds = (candidates ?? []).map((candidate) => String(candidate.id));
  }

  if (!selectedIds.length) {
    await recordApiAuditEvent({
      eventType: "webhook_delivery.retried",
      subjectType: "webhook_delivery",
      status: "allowed",
      requestMetadata: {
        reason: input.reason,
        actorId: input.actorId,
        previousStatus: status,
        requeued: 0
      }
    });

    return { requeued: 0, deliveryIds: [], status: "queued" };
  }

  const { data, error } = await supabase
    .from("webhook_deliveries")
    .update({
      status: "queued",
      last_error: null,
      delivered_at: null
    })
    .in("id", selectedIds.slice(0, limit))
    .in("status", retryableStatuses)
    .select("*");

  if (error) {
    throw new Error(`Webhook delivery retry update failed: ${error.message}`);
  }

  const updatedIds = (data ?? []).map((delivery) => String(delivery.id));

  await recordApiAuditEvent({
    eventType: "webhook_delivery.retried",
    subjectType: "webhook_delivery",
    subjectId: updatedIds.join(",") || undefined,
    status: "allowed",
    requestMetadata: {
      reason: input.reason,
      actorId: input.actorId,
      previousStatus: status,
      requeued: updatedIds.length
    }
  });

  return {
    requeued: updatedIds.length,
    deliveryIds: updatedIds,
    status: "queued"
  };
}

export async function replayWebhookDeliveries(
  input: ReplayWebhookDeliveriesInput = {}
): Promise<ReplayWebhookDeliveriesResult> {
  const replayableStatuses: WebhookDeliveryRecord["status"][] = ["failed", "blocked", "delivered"];
  const status = input.status ?? "failed";
  const deliveryIds = Array.from(new Set(input.deliveryIds?.map((id) => String(id).trim()).filter(Boolean) ?? []));
  const requestedLimit = input.limit ?? (deliveryIds.length || 10);
  const limit = Math.max(1, Math.min(requestedLimit, 50));

  if (!replayableStatuses.includes(status)) {
    throw new Error("Only failed, blocked, or delivered webhook deliveries can be replayed");
  }

  const policy = await runPolicyCheck({
    subjectType: "webhook_delivery",
    actionKey: "replay_webhook_delivery",
    input: {
      deliveryIds,
      status,
      limit,
      reason: input.reason,
      actorId: input.actorId
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Webhook delivery replay blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const candidates = seedWebhookDeliveries
      .filter((delivery) => replayableStatuses.includes(delivery.status))
      .filter((delivery) => (deliveryIds.length ? deliveryIds.includes(delivery.id) : delivery.status === status))
      .slice(0, limit);
    const replayed = candidates.map((delivery) => ({
      id: `webhook-delivery-${crypto.randomUUID()}`,
      subscriptionId: delivery.subscriptionId,
      eventType: delivery.eventType,
      subjectId: delivery.subjectId,
      payload: {
        ...delivery.payload,
        replayOfDeliveryId: delivery.id
      },
      status: "queued" as const,
      attempts: 0,
      createdAt: new Date().toISOString()
    }));

    seedWebhookDeliveries.unshift(...replayed);

    await recordApiAuditEvent({
      eventType: "webhook_delivery.replayed",
      subjectType: "webhook_delivery",
      subjectId: candidates.map((delivery) => delivery.id).join(",") || undefined,
      status: "allowed",
      requestMetadata: {
        reason: input.reason,
        actorId: input.actorId,
        sourceStatus: status,
        replayed: replayed.length,
        replayedDeliveryIds: replayed.map((delivery) => delivery.id)
      }
    });

    return {
      replayed: replayed.length,
      sourceDeliveryIds: candidates.map((delivery) => delivery.id),
      replayedDeliveryIds: replayed.map((delivery) => delivery.id),
      status: "queued"
    };
  }

  let query = supabase
    .from("webhook_deliveries")
    .select("*")
    .in("status", replayableStatuses)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (deliveryIds.length) {
    query = query.in("id", deliveryIds.slice(0, limit));
  } else {
    query = query.eq("status", status);
  }

  const { data: candidates, error: selectError } = await query;

  if (selectError) {
    throw new Error(`Webhook delivery replay selection failed: ${selectError.message}`);
  }

  const sourceDeliveries = (candidates ?? []).map(mapWebhookDelivery);

  if (!sourceDeliveries.length) {
    await recordApiAuditEvent({
      eventType: "webhook_delivery.replayed",
      subjectType: "webhook_delivery",
      status: "allowed",
      requestMetadata: {
        reason: input.reason,
        actorId: input.actorId,
        sourceStatus: status,
        replayed: 0
      }
    });

    return { replayed: 0, sourceDeliveryIds: [], replayedDeliveryIds: [], status: "queued" };
  }

  const rows = sourceDeliveries.map((delivery) => ({
    subscription_id: delivery.subscriptionId,
    event_type: delivery.eventType,
    subject_id: delivery.subjectId,
    payload: {
      ...delivery.payload,
      replayOfDeliveryId: delivery.id
    },
    status: "queued",
    attempts: 0
  }));
  const { data: replayedRows, error: insertError } = await supabase.from("webhook_deliveries").insert(rows).select("*");

  if (insertError) {
    throw new Error(`Webhook delivery replay insert failed: ${insertError.message}`);
  }

  const replayedDeliveryIds = (replayedRows ?? []).map((delivery) => String(delivery.id));

  await recordApiAuditEvent({
    eventType: "webhook_delivery.replayed",
    subjectType: "webhook_delivery",
    subjectId: sourceDeliveries.map((delivery) => delivery.id).join(",") || undefined,
    status: "allowed",
    requestMetadata: {
      reason: input.reason,
      actorId: input.actorId,
      sourceStatus: status,
      replayed: replayedDeliveryIds.length,
      replayedDeliveryIds
    }
  });

  return {
    replayed: replayedDeliveryIds.length,
    sourceDeliveryIds: sourceDeliveries.map((delivery) => delivery.id),
    replayedDeliveryIds,
    status: "queued"
  };
}

export async function runWebhookRetryScheduler(
  input: WebhookRetrySchedulerInput = {}
): Promise<WebhookRetrySchedulerResult> {
  const retryLimit = Math.max(1, Math.min(Number(input.retryLimit ?? 25), 50));
  const deliveryLimit = Math.max(1, Math.min(Number(input.deliveryLimit ?? 25), 50));
  const dryRun = input.dryRun ?? true;
  const includeBlocked = input.includeBlocked ?? true;
  const [failedCandidates, blockedCandidates] = await Promise.all([
    listWebhookDeliveries("failed"),
    includeBlocked ? listWebhookDeliveries("blocked") : Promise.resolve([])
  ]);

  if (dryRun) {
    return {
      dryRun,
      retryLimit,
      deliveryLimit,
      failedCandidates: failedCandidates.length,
      blockedCandidates: blockedCandidates.length,
      failedRetry: { requeued: 0, deliveryIds: [], status: "queued" },
      blockedRetry: includeBlocked ? { requeued: 0, deliveryIds: [], status: "queued" } : undefined,
      delivery: { processed: 0, delivered: 0, failed: 0, blocked: 0, dryRun: true, attempts: [] },
      nextActions: [
        failedCandidates.length || blockedCandidates.length
          ? "Retry candidates exist. Run scheduler in live mode after confirming target endpoints and signing secrets."
          : "No failed or blocked webhook deliveries currently need retry."
      ]
    };
  }

  const failedRetry = await retryWebhookDeliveries({
    status: "failed",
    limit: retryLimit,
    actorId: input.actorId,
    reason: input.reason ?? "scheduled webhook retry"
  });
  const blockedRetry = includeBlocked
    ? await retryWebhookDeliveries({
        status: "blocked",
        limit: retryLimit,
        actorId: input.actorId,
        reason: input.reason ?? "scheduled webhook blocked retry"
      })
    : undefined;
  const delivery = await processWebhookDeliveries({
    limit: deliveryLimit,
    dryRun: false
  });
  const nextActions: string[] = [];

  if (failedRetry.requeued || blockedRetry?.requeued) {
    nextActions.push("Retry scheduler requeued webhook deliveries and ran the delivery worker.");
  }

  if (delivery.failed || delivery.blocked) {
    nextActions.push("Some webhook deliveries still failed or blocked; inspect attempt errors before the next live retry.");
  }

  if (!nextActions.length) {
    nextActions.push("Webhook retry scheduler completed without pending retry work.");
  }

  return {
    dryRun,
    retryLimit,
    deliveryLimit,
    failedCandidates: failedCandidates.length,
    blockedCandidates: blockedCandidates.length,
    failedRetry,
    blockedRetry,
    delivery,
    nextActions
  };
}

async function listQueuedWebhookDeliveries(limit: number): Promise<InternalWebhookDelivery[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedWebhookDeliveries
      .filter((delivery) => delivery.status === "queued")
      .slice(0, limit)
      .map((delivery) => ({
        ...delivery,
        subscription: seedWebhookSubscriptions.find((subscription) => subscription.id === delivery.subscriptionId) as
          | InternalWebhookSubscription
          | undefined
      }));
  }

  const { data, error } = await supabase
    .from("webhook_deliveries")
    .select("*, webhook_subscriptions(*)")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Queued webhook delivery query failed: ${error.message}`);
  }

  return (data ?? []).map(mapInternalWebhookDelivery);
}

async function recordWebhookDeliveryAttempt(input: {
  deliveryId: string;
  targetUrl: string;
  status: WebhookDeliveryAttemptRecord["status"];
  statusCode?: number;
  error?: string;
  signaturePreview?: string;
}): Promise<WebhookDeliveryAttemptRecord> {
  const createdAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const record: WebhookDeliveryAttemptRecord = {
      id: `webhook-attempt-${crypto.randomUUID()}`,
      deliveryId: input.deliveryId,
      targetUrl: input.targetUrl,
      status: input.status,
      statusCode: input.statusCode,
      error: input.error,
      signaturePreview: input.signaturePreview,
      createdAt
    };
    seedWebhookDeliveryAttempts.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("webhook_delivery_attempts")
    .insert({
      delivery_id: input.deliveryId,
      target_url: input.targetUrl,
      status: input.status,
      status_code: input.statusCode,
      error: input.error,
      signature_preview: input.signaturePreview
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Webhook delivery attempt creation failed: ${error.message}`);
  }

  return mapWebhookDeliveryAttempt(data);
}

async function updateWebhookDeliveryStatus(input: {
  deliveryId: string;
  status: WebhookDeliveryRecord["status"];
  error?: string;
}) {
  const deliveredAt = input.status === "delivered" ? new Date().toISOString() : undefined;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const delivery = seedWebhookDeliveries.find((item) => item.id === input.deliveryId);

    if (delivery) {
      delivery.status = input.status;
      delivery.attempts += 1;
      delivery.lastError = input.error;
      delivery.deliveredAt = deliveredAt;
    }

    return;
  }

  const { error } = await supabase
    .from("webhook_deliveries")
    .update({
      status: input.status,
      last_error: input.error,
      delivered_at: deliveredAt
    })
    .eq("id", input.deliveryId);

  if (error) {
    throw new Error(`Webhook delivery update failed: ${error.message}`);
  }

  const { error: incrementError } = await supabase.rpc("increment_webhook_delivery_attempts", {
    delivery_id_input: input.deliveryId
  });

  if (incrementError) {
    throw new Error(`Webhook delivery attempt increment failed: ${incrementError.message}`);
  }
}

export async function processWebhookDeliveries(
  input: ProcessWebhookDeliveriesInput = {}
): Promise<ProcessWebhookDeliveriesResult> {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 50));
  const dryRun = input.dryRun ?? false;
  const queued = await listQueuedWebhookDeliveries(limit);
  const attempts: WebhookDeliveryAttemptRecord[] = [];

  let delivered = 0;
  let failed = 0;
  let blocked = 0;

  for (const delivery of queued) {
    const subscription = delivery.subscription;

    if (!subscription || subscription.status !== "active") {
      blocked += 1;
      attempts.push(
        await recordWebhookDeliveryAttempt({
          deliveryId: delivery.id,
          targetUrl: subscription?.targetUrl ?? "unknown",
          status: "blocked",
          error: "Webhook subscription is missing or inactive"
        })
      );
      await updateWebhookDeliveryStatus({
        deliveryId: delivery.id,
        status: "blocked",
        error: "Webhook subscription is missing or inactive"
      });
      continue;
    }

    const secretMaterial = subscription.signingSecret;

    if (!secretMaterial) {
      blocked += 1;
      attempts.push(
        await recordWebhookDeliveryAttempt({
          deliveryId: delivery.id,
          targetUrl: subscription.targetUrl,
          status: "blocked",
          error: "Webhook signing secret is unavailable or cannot be decrypted"
        })
      );
      await updateWebhookDeliveryStatus({
        deliveryId: delivery.id,
        status: "blocked",
        error: "Webhook signing secret is unavailable or cannot be decrypted"
      });
      continue;
    }

    const body = JSON.stringify({
      id: delivery.id,
      eventType: delivery.eventType,
      subjectId: delivery.subjectId,
      payload: delivery.payload,
      createdAt: delivery.createdAt
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signWebhookPayload(secretMaterial, timestamp, body);
    const signaturePreview = previewSignature(signature);

    if (dryRun) {
      attempts.push(
        await recordWebhookDeliveryAttempt({
          deliveryId: delivery.id,
          targetUrl: subscription.targetUrl,
          status: "dry_run",
          statusCode: 200,
          signaturePreview
        })
      );
      continue;
    }

    try {
      const response = await fetch(subscription.targetUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "TheSeniorGuru-Webhooks/0.1",
          "x-senior-guru-event": delivery.eventType,
          "x-senior-guru-signature": signature
        },
        body
      });

      if (response.ok) {
        delivered += 1;
        attempts.push(
          await recordWebhookDeliveryAttempt({
            deliveryId: delivery.id,
            targetUrl: subscription.targetUrl,
            status: "delivered",
            statusCode: response.status,
            signaturePreview
          })
        );
        await updateWebhookDeliveryStatus({ deliveryId: delivery.id, status: "delivered" });
      } else {
        failed += 1;
        const error = `Webhook target returned HTTP ${response.status}`;
        attempts.push(
          await recordWebhookDeliveryAttempt({
            deliveryId: delivery.id,
            targetUrl: subscription.targetUrl,
            status: "failed",
            statusCode: response.status,
            error,
            signaturePreview
          })
        );
        await updateWebhookDeliveryStatus({ deliveryId: delivery.id, status: "failed", error });
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : "Webhook delivery failed";
      attempts.push(
        await recordWebhookDeliveryAttempt({
          deliveryId: delivery.id,
          targetUrl: subscription.targetUrl,
          status: "failed",
          error: message,
          signaturePreview
        })
      );
      await updateWebhookDeliveryStatus({ deliveryId: delivery.id, status: "failed", error: message });
    }
  }

  return {
    processed: queued.length,
    delivered,
    failed,
    blocked,
    dryRun,
    attempts
  };
}

export async function listApiAuditEvents(apiClientId?: string): Promise<ApiAuditEventRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return apiClientId ? seedApiAuditEvents.filter((event) => event.apiClientId === apiClientId) : seedApiAuditEvents;
  }

  let query = supabase.from("api_audit_events").select("*").order("created_at", { ascending: false }).limit(100);

  if (apiClientId) {
    query = query.eq("api_client_id", apiClientId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`API audit events query failed: ${error.message}`);
  }

  return (data ?? []).map(mapApiAuditEvent);
}

function countBy<T>(items: T[], keyFor: (item: T) => string | undefined) {
  const counts = new Map<string, number>();

  for (const item of items) {
    const key = keyFor(item);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

function topCounts(counts: Map<string, number>, limit = 5) {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([eventType, count]) => ({ eventType, count }));
}

function getApiUsageRetentionPolicy(auditEvents: ApiAuditEventRecord[]) {
  const auditRetentionDays = Math.max(90, Math.min(Number(process.env.API_USAGE_RETENTION_DAYS ?? defaultApiUsageRetentionDays), 3650));
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - auditRetentionDays);
  const retentionCutoff = cutoff.toISOString();

  return {
    auditRetentionDays,
    retentionCutoff,
    retentionCandidates: auditEvents.filter((event) => Date.parse(event.createdAt) < Date.parse(retentionCutoff)).length,
    purgeStatus: "blocked_pending_owner_approval" as const,
    archiveRequired: true,
    legalHoldReviewRequired: true
  };
}

export async function getApiUsageAnalytics(input: { apiClientId?: string; windowDays?: number } = {}): Promise<ApiUsageAnalyticsSummary> {
  const windowDays = Math.max(1, Math.min(Number(input.windowDays ?? 30), 365));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const [allClients, allAuditEvents, allDeliveries] = await Promise.all([
    listApiClients(),
    listApiAuditEvents(input.apiClientId),
    listWebhookDeliveries()
  ]);
  const clients = input.apiClientId ? allClients.filter((client) => client.id === input.apiClientId) : allClients;
  const source: ApiUsageAnalyticsSummary["source"] = getSupabaseAdminClient() ? "supabase" : "local_fallback";
  const clientIds = new Set(clients.map((client) => client.id));
  const auditEvents = allAuditEvents
    .filter((event) => !input.apiClientId || event.apiClientId === input.apiClientId)
    .filter((event) => Date.parse(event.createdAt) >= Date.parse(since));
  const retentionPolicy = getApiUsageRetentionPolicy(
    allAuditEvents.filter((event) => !input.apiClientId || event.apiClientId === input.apiClientId)
  );
  const subscriptions = (await Promise.all(clients.map((client) => listWebhookSubscriptions(client.id)))).flat();
  const keyPairs = await Promise.all(clients.map(async (client) => ({ client, keys: await listApiKeys(client.id) })));
  const eventCounts = countBy(auditEvents, (event) => event.eventType);
  const deliveriesByClient = countBy(
    allDeliveries.filter((delivery) => {
      const subscription = subscriptions.find((item) => item.id === delivery.subscriptionId);
      return subscription ? clientIds.has(subscription.apiClientId) : false;
    }),
    (delivery) => subscriptions.find((subscription) => subscription.id === delivery.subscriptionId)?.apiClientId
  );
  const clientAnalytics: ApiUsageAnalyticsClient[] = clients.map((client) => {
    const events = auditEvents.filter((event) => event.apiClientId === client.id);
    const keys = keyPairs.find((pair) => pair.client.id === client.id)?.keys ?? [];
    const clientSubscriptions = subscriptions.filter((subscription) => subscription.apiClientId === client.id);
    const latest = events[0]?.createdAt;

    return {
      apiClientId: client.id,
      name: client.name,
      ownerType: client.ownerType,
      status: client.status,
      requests: events.length,
      allowed: events.filter((event) => event.status === "allowed").length,
      blocked: events.filter((event) => event.status === "blocked").length,
      rateLimited: events.filter((event) => event.status === "rate_limited").length,
      activeKeys: keys.filter((key) => key.status === "active").length,
      revokedKeys: keys.filter((key) => key.status === "revoked").length,
      webhookSubscriptions: clientSubscriptions.length,
      webhookDeliveries: deliveriesByClient.get(client.id) ?? 0,
      lastRequestAt: latest,
      topEvents: topCounts(countBy(events, (event) => event.eventType), 3)
    };
  });
  const totals = {
    clients: clientAnalytics.length,
    requests: auditEvents.length,
    allowed: auditEvents.filter((event) => event.status === "allowed").length,
    blocked: auditEvents.filter((event) => event.status === "blocked").length,
    rateLimited: auditEvents.filter((event) => event.status === "rate_limited").length,
    activeKeys: clientAnalytics.reduce((sum, client) => sum + client.activeKeys, 0),
    revokedKeys: clientAnalytics.reduce((sum, client) => sum + client.revokedKeys, 0),
    webhookDeliveries: clientAnalytics.reduce((sum, client) => sum + client.webhookDeliveries, 0)
  };

  return {
    generatedAt: new Date().toISOString(),
    source,
    windowDays,
    since,
    retentionPolicy,
    totals,
    clients: clientAnalytics.sort((left, right) => right.requests - left.requests || left.name.localeCompare(right.name)),
    topEvents: topCounts(eventCounts, 8),
    nextActions: [
      ...(totals.rateLimited ? ["Review rate-limited clients and confirm limits match partner contracts."] : []),
      ...(totals.blocked ? ["Review blocked partner API calls for invalid keys, missing scopes, or integration drift."] : []),
      ...(clientAnalytics.some((client) => client.activeKeys === 0)
        ? ["Issue active API keys only for approved partner clients that are ready to test."]
        : []),
      ...(!totals.requests ? ["No partner API usage exists in the selected window; run a partner smoke call after issuing a scoped key."] : []),
      ...(totals.requests && !totals.blocked && !totals.rateLimited ? ["Partner API usage is flowing without blocked or rate-limited calls in the selected window."] : []),
      ...(retentionPolicy.retentionCandidates
        ? ["Export API usage evidence and complete owner/legal retention approval before enabling any purge workflow."]
        : [])
    ]
  };
}

function csvCell(value: string | number | undefined) {
  const text = value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function exportApiUsageAnalytics(input: { apiClientId?: string; windowDays?: number } = {}) {
  const summary = await getApiUsageAnalytics(input);
  const headers = [
    "api_client_id",
    "name",
    "owner_type",
    "status",
    "requests",
    "allowed",
    "blocked",
    "rate_limited",
    "active_keys",
    "revoked_keys",
    "webhook_subscriptions",
    "webhook_deliveries",
    "last_request_at",
    "top_events",
    "retention_cutoff",
    "retention_candidates",
    "purge_status"
  ];
  const rows = summary.clients.map((client) => [
    client.apiClientId,
    client.name,
    client.ownerType,
    client.status,
    client.requests,
    client.allowed,
    client.blocked,
    client.rateLimited,
    client.activeKeys,
    client.revokedKeys,
    client.webhookSubscriptions,
    client.webhookDeliveries,
    client.lastRequestAt,
    client.topEvents.map((event) => `${event.eventType}:${event.count}`).join("|"),
    summary.retentionPolicy.retentionCutoff,
    summary.retentionPolicy.retentionCandidates,
    summary.retentionPolicy.purgeStatus
  ]);

  return {
    summary,
    csv: [
      headers.map(csvCell).join(","),
      ...rows.map((row) => row.map(csvCell).join(","))
    ].join("\n"),
    filename: `senior-guru-api-usage-${summary.windowDays}d-${summary.generatedAt.slice(0, 10)}.csv`
  };
}

function getReplaySourceDeliveryId(delivery: WebhookDeliveryRecord) {
  const replayOfDeliveryId = delivery.payload.replayOfDeliveryId;
  return typeof replayOfDeliveryId === "string" && replayOfDeliveryId.trim() ? replayOfDeliveryId.trim() : undefined;
}

function getReplayAuditValue(auditEvent: ApiAuditEventRecord | undefined, key: string) {
  const value = auditEvent?.requestMetadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function exportWebhookReplayEvidence(input: {
  format?: "json" | "csv";
  limit?: number;
  apiClientId?: string;
} = {}): Promise<WebhookReplayEvidenceExport> {
  const format = input.format ?? "json";
  const limit = Math.max(1, Math.min(Number(input.limit ?? 100), 500));
  const source: WebhookReplayEvidenceExport["source"] = getSupabaseAdminClient() ? "supabase" : "local_fallback";
  const [deliveries, auditEvents, subscriptions] = await Promise.all([
    listWebhookDeliveries(),
    listApiAuditEvents(input.apiClientId),
    input.apiClientId ? listWebhookSubscriptions(input.apiClientId) : listWebhookSubscriptions()
  ]);
  const subscriptionById = new Map(subscriptions.map((subscription) => [subscription.id, subscription]));
  const replayedDeliveries = deliveries
    .filter((delivery) => Boolean(getReplaySourceDeliveryId(delivery)))
    .filter((delivery) => {
      if (!input.apiClientId) return true;
      return subscriptionById.get(delivery.subscriptionId)?.apiClientId === input.apiClientId;
    })
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
    .slice(0, limit);
  const sourceIds = replayedDeliveries.map(getReplaySourceDeliveryId).filter(Boolean) as string[];
  const evidenceDeliveryIds = [...replayedDeliveries.map((delivery) => delivery.id), ...sourceIds];
  const [attempts] = await Promise.all([listWebhookDeliveryAttempts(evidenceDeliveryIds)]);
  const deliveryById = new Map(deliveries.map((delivery) => [delivery.id, delivery]));
  const attemptsByDeliveryId = countBy(attempts, (attempt) => attempt.deliveryId);
  const replayAudits = auditEvents.filter((event) => event.eventType === "webhook_delivery.replayed");

  const rows: WebhookReplayEvidenceExportRow[] = replayedDeliveries.map((replayed) => {
    const sourceDeliveryId = getReplaySourceDeliveryId(replayed) ?? "";
    const sourceDelivery = deliveryById.get(sourceDeliveryId);
    const auditEvent = replayAudits.find((event) => {
      const replayedDeliveryIds = event.requestMetadata?.replayedDeliveryIds;
      return (
        String(event.subjectId ?? "").split(",").map((value) => value.trim()).includes(sourceDeliveryId) ||
        (Array.isArray(replayedDeliveryIds) && replayedDeliveryIds.map(String).includes(replayed.id))
      );
    });
    const subscription = subscriptionById.get(replayed.subscriptionId);

    return {
      replayedDeliveryId: replayed.id,
      sourceDeliveryId,
      subscriptionId: replayed.subscriptionId,
      apiClientId: subscription?.apiClientId,
      eventType: replayed.eventType,
      subjectId: replayed.subjectId,
      sourceStatus: sourceDelivery?.status,
      replayStatus: replayed.status,
      sourceAttempts: attemptsByDeliveryId.get(sourceDeliveryId) ?? sourceDelivery?.attempts ?? 0,
      replayAttempts: attemptsByDeliveryId.get(replayed.id) ?? replayed.attempts,
      sourceCreatedAt: sourceDelivery?.createdAt,
      replayCreatedAt: replayed.createdAt,
      lastSourceError: sourceDelivery?.lastError,
      auditEventId: auditEvent?.id,
      auditCreatedAt: auditEvent?.createdAt,
      replayReason: getReplayAuditValue(auditEvent, "reason"),
      replayActorId: getReplayAuditValue(auditEvent, "actorId")
    };
  });
  const generatedAt = new Date().toISOString();
  const headers = [
    "replayed_delivery_id",
    "source_delivery_id",
    "subscription_id",
    "api_client_id",
    "event_type",
    "subject_id",
    "source_status",
    "replay_status",
    "source_attempts",
    "replay_attempts",
    "source_created_at",
    "replay_created_at",
    "last_source_error",
    "audit_event_id",
    "audit_created_at",
    "replay_reason",
    "replay_actor_id"
  ];
  const csvRows = rows.map((row) => [
    row.replayedDeliveryId,
    row.sourceDeliveryId,
    row.subscriptionId,
    row.apiClientId,
    row.eventType,
    row.subjectId,
    row.sourceStatus,
    row.replayStatus,
    row.sourceAttempts,
    row.replayAttempts,
    row.sourceCreatedAt,
    row.replayCreatedAt,
    row.lastSourceError,
    row.auditEventId,
    row.auditCreatedAt,
    row.replayReason,
    row.replayActorId
  ]);

  return {
    generatedAt,
    source,
    format,
    limit,
    totals: {
      replayedDeliveries: rows.length,
      auditedReplays: rows.filter((row) => Boolean(row.auditEventId)).length,
      missingSourceDeliveries: rows.filter((row) => !row.sourceStatus).length
    },
    rows,
    csv: [
      headers.map(csvCell).join(","),
      ...csvRows.map((row) => row.map(csvCell).join(","))
    ].join("\n"),
    filename: `senior-guru-webhook-replay-evidence-${generatedAt.slice(0, 10)}.${format === "csv" ? "csv" : "json"}`
  };
}

export async function authenticatePartnerApiRequest(
  request: Request,
  requiredScope: ApiClientScope,
  options?: {
    eventType?: string;
    subjectType?: string;
    subjectId?: string;
  }
): Promise<ApiAuthenticationResult> {
  const eventType = options?.eventType ?? `partner.${requiredScope}`;
  const secret = getRequestApiKey(request);

  if (!secret) {
    await recordApiAuditEvent({
      eventType,
      subjectType: options?.subjectType,
      subjectId: options?.subjectId,
      status: "blocked",
      requestMetadata: { reason: "missing_api_key" }
    });

    return { ok: false, status: 401, error: "Missing API key" };
  }

  const keyLookup = await findClientByApiKey(secret);

  if (!keyLookup) {
    await recordApiAuditEvent({
      eventType,
      subjectType: options?.subjectType,
      subjectId: options?.subjectId,
      status: "blocked",
      requestMetadata: { reason: "invalid_api_key" }
    });

    return { ok: false, status: 401, error: "Invalid API key" };
  }

  const { client, apiKeyId } = keyLookup;

  if (!client.scopes.includes(requiredScope)) {
    await recordApiAuditEvent({
      apiClientId: client.id,
      eventType,
      subjectType: options?.subjectType,
      subjectId: options?.subjectId,
      status: "blocked",
      requestMetadata: { reason: "missing_scope", requiredScope, apiKeyId }
    });

    return { ok: false, status: 403, error: `Missing required scope: ${requiredScope}` };
  }

  if (await isRateLimited(client)) {
    await recordApiAuditEvent({
      apiClientId: client.id,
      eventType,
      subjectType: options?.subjectType,
      subjectId: options?.subjectId,
      status: "rate_limited",
      requestMetadata: { reason: "rate_limit_exceeded", limit: client.rateLimitPerMinute, apiKeyId }
    });

    return { ok: false, status: 429, error: "Rate limit exceeded", retryAfterSeconds: 60 };
  }

  await recordApiAuditEvent({
    apiClientId: client.id,
    eventType,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    status: "allowed",
    requestMetadata: { requiredScope, apiKeyId }
  });

  return {
    ok: true,
    client,
    apiKeyId,
    rateLimit: {
      limit: client.rateLimitPerMinute,
      windowSeconds: 60
    }
  };
}
