import crypto from "node:crypto";
import type {
  ApiAuditEventRecord,
  ApiAuthenticationResult,
  ApiClientRecord,
  ApiClientScope,
  ApiKeyRecord,
  CreateApiClientInput,
  CreateApiKeyInput,
  CreatedApiKeyRecord,
  CreatedWebhookSubscriptionRecord,
  CreateWebhookSubscriptionInput,
  EnqueueWebhookDeliveryInput,
  WebhookDeliveryRecord,
  WebhookEventType,
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
  "claims:write",
  "webhooks:write"
];

const seedApiClients: ApiClientRecord[] = [];
const seedApiKeys: ApiKeyRecord[] = [];
const seedApiKeyHashes = new Map<string, string>();
const seedWebhookSubscriptions: WebhookSubscriptionRecord[] = [];
const seedWebhookDeliveries: WebhookDeliveryRecord[] = [];
const seedApiAuditEvents: ApiAuditEventRecord[] = [];
const seedRateCounters = new Map<string, { windowStart: number; count: number }>();

function previewSecret(secret: string) {
  return `${secret.slice(0, 8)}...${secret.slice(-4)}`;
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
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
    expiresAt: row.expires_at ? String(row.expires_at) : undefined
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

function mapWebhookDelivery(row: Record<string, unknown>): WebhookDeliveryRecord {
  return {
    id: String(row.id),
    subscriptionId: String(row.subscription_id),
    eventType: row.event_type as WebhookEventType,
    subjectId: row.subject_id ? String(row.subject_id) : undefined,
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
    status: row.status as WebhookDeliveryRecord["status"],
    attempts: Number(row.attempts ?? 0),
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

async function findClientByApiKey(secret: string): Promise<ApiClientRecord | null> {
  const secretHash = sha256(secret);
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const apiKeyId = seedApiKeyHashes.get(secretHash);
    const apiKey = apiKeyId ? seedApiKeys.find((key) => key.id === apiKeyId && key.status === "active") : null;

    if (!apiKey) {
      return null;
    }

    return seedApiClients.find((client) => client.id === apiKey.apiClientId && client.status === "active") ?? null;
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

  return mapClient(clientRow);
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
    scopes: input.scopes ?? ["providers:read", "events:read"],
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
      signing_secret_preview: record.signingSecretPreview
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Webhook subscription creation failed: ${error.message}`);
  }

  return { ...mapWebhookSubscription(data), signingSecret };
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

  const client = await findClientByApiKey(secret);

  if (!client) {
    await recordApiAuditEvent({
      eventType,
      subjectType: options?.subjectType,
      subjectId: options?.subjectId,
      status: "blocked",
      requestMetadata: { reason: "invalid_api_key" }
    });

    return { ok: false, status: 401, error: "Invalid API key" };
  }

  if (!client.scopes.includes(requiredScope)) {
    await recordApiAuditEvent({
      apiClientId: client.id,
      eventType,
      subjectType: options?.subjectType,
      subjectId: options?.subjectId,
      status: "blocked",
      requestMetadata: { reason: "missing_scope", requiredScope }
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
      requestMetadata: { reason: "rate_limit_exceeded", limit: client.rateLimitPerMinute }
    });

    return { ok: false, status: 429, error: "Rate limit exceeded", retryAfterSeconds: 60 };
  }

  await recordApiAuditEvent({
    apiClientId: client.id,
    eventType,
    subjectType: options?.subjectType,
    subjectId: options?.subjectId,
    status: "allowed",
    requestMetadata: { requiredScope }
  });

  return { ok: true, client };
}
