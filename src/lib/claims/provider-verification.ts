import type {
  CompleteProviderVerificationAttemptInput,
  ConfirmProviderVerificationCodeInput,
  CreateProviderVerificationAttemptInput,
  IssueProviderVerificationCodeInput,
  ProviderClaimStatus,
  ProviderVerificationCodeDeliveryRecord,
  ProviderVerificationDeliveryReadiness,
  ProviderVerificationDeliveryReadinessChannel,
  ProviderVerificationDeliveryRecord,
  ProviderVerificationAttemptRecord,
  ProviderVerificationExpiryResult,
  ProviderVerificationMethod,
  SendProviderVerificationAttemptInput
} from "@/lib/domain/claims";
import { getAppEnv } from "@/lib/env";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { createHash, randomInt } from "node:crypto";

const seedVerificationAttempts: ProviderVerificationAttemptRecord[] = [];
let fallbackVerificationAttemptSequence = 0;
const verificationTtlMs = 7 * 24 * 60 * 60 * 1000;
const verificationCodeTtlMs = 30 * 60 * 1000;

function methodToClaimStatus(method: ProviderVerificationMethod): ProviderClaimStatus {
  if (method === "business_email" || method === "domain_dns") {
    return "email_pending";
  }

  if (method === "business_phone") {
    return "phone_pending";
  }

  if (method === "license_document") {
    return "document_pending";
  }

  return "admin_review";
}

function mapJson(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function mapVerificationAttempt(row: Record<string, unknown>): ProviderVerificationAttemptRecord {
  return {
    id: String(row.id),
    providerClaimId: String(row.provider_claim_id),
    method: row.method as ProviderVerificationAttemptRecord["method"],
    status: row.status as ProviderVerificationAttemptRecord["status"],
    target: row.target ? String(row.target) : undefined,
    attemptPayload: mapJson(row.attempt_payload),
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function deliveryChannelForMethod(method: ProviderVerificationMethod): ProviderVerificationDeliveryRecord["channel"] {
  if (method === "business_email" || method === "domain_dns") return "email";
  if (method === "business_phone") return "sms";
  if (method === "license_document" || method === "admin_manual") return "manual";
  return "manual";
}

function buildVerificationActionUrl(attempt: ProviderVerificationAttemptRecord) {
  const env = getAppEnv();
  return `${env.appUrl.replace(/\/$/, "")}/provider/claims/${attempt.providerClaimId}?verification=${attempt.id}`;
}

function isExpiredPendingAttempt(attempt: ProviderVerificationAttemptRecord, now = new Date()) {
  return attempt.status === "pending" && Boolean(attempt.expiresAt) && Date.parse(attempt.expiresAt as string) <= now.getTime();
}

function defaultExpiresAt(now = new Date()) {
  return new Date(now.getTime() + verificationTtlMs).toISOString();
}

function assertAttemptCanBeCompleted(attempt: ProviderVerificationAttemptRecord, now = new Date()) {
  if (attempt.status !== "pending") {
    throw new Error("Provider verification attempt is already completed");
  }

  if (isExpiredPendingAttempt(attempt, now)) {
    throw new Error("Provider verification attempt has expired; create a new verification attempt");
  }
}

function nonExpiredPendingAttempt(attempts: ProviderVerificationAttemptRecord[], input: CreateProviderVerificationAttemptInput) {
  const now = new Date();

  return attempts
    .filter((attempt) => attempt.providerClaimId === input.claimId)
    .filter((attempt) => attempt.method === input.method)
    .filter((attempt) => attempt.status === "pending")
    .filter((attempt) => !isExpiredPendingAttempt(attempt, now))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function buildDeliveryRecord(
  attempt: ProviderVerificationAttemptRecord,
  input: SendProviderVerificationAttemptInput,
  policyDecision: string
): ProviderVerificationDeliveryRecord {
  const channel = input.channel ?? deliveryChannelForMethod(attempt.method);
  const target = input.target ?? attempt.target;
  const readiness = deliveryReadinessForChannel(channel);
  const canSendLive = Boolean(target) && readiness.status === "ready";
  const sentAt = canSendLive && channel !== "manual" ? new Date().toISOString() : undefined;

  return {
    attemptId: attempt.id,
    status: canSendLive && channel !== "manual" ? "sent" : "manual_required",
    channel,
    target,
    actionUrl: buildVerificationActionUrl(attempt),
    sentAt,
    deliveryPayload: {
      messageTemplate: input.messageTemplate ?? "provider_claim_verification",
      policyDecision,
      providerClaimId: attempt.providerClaimId,
      method: attempt.method,
      deliveryProvider: readiness.provider,
      deliveryReadiness: readiness.status,
      blockers: [
        ...readiness.blockers,
        ...(!target ? ["Verification delivery target is required before non-manual delivery can be sent."] : [])
      ],
      nextActions: readiness.nextActions
    }
  };
}

function assertCodeMethod(attempt: ProviderVerificationAttemptRecord) {
  if (!["business_email", "business_phone", "domain_dns"].includes(attempt.method)) {
    throw new Error("Verification code can only be issued for business email, business phone, or domain DNS attempts");
  }
}

function generateVerificationCode() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

function hashVerificationCode(attemptId: string, code: string) {
  return createHash("sha256").update(`${attemptId}:${code.trim()}`).digest("hex");
}

function maskVerificationCode(code: string) {
  return `${code.slice(0, 2)}****`;
}

function buildCodeDeliveryRecord(
  attempt: ProviderVerificationAttemptRecord,
  input: IssueProviderVerificationCodeInput,
  code: string,
  codeExpiresAt: string,
  policyDecision: string
): ProviderVerificationCodeDeliveryRecord {
  const baseDelivery = buildDeliveryRecord(
    attempt,
    {
      attemptId: input.attemptId,
      channel: input.channel ?? deliveryChannelForMethod(attempt.method),
      target: input.target,
      actorId: input.actorId,
      messageTemplate: "provider_claim_verification_code"
    },
    policyDecision
  );

  return {
    ...baseDelivery,
    status: "manual_required",
    sentAt: undefined,
    codeExpiresAt,
    manualCode: code,
    maskedCode: maskVerificationCode(code),
    deliveryPayload: {
      ...baseDelivery.deliveryPayload,
      codeExpiresAt,
      maskedCode: maskVerificationCode(code),
      deliveryProvider: "owner_console_manual_delivery",
      instruction: "Deliver this verification code to the verified business email, phone, or DNS contact before marking the claim approved."
    }
  };
}

function verificationDeliveryChannels(): ProviderVerificationDeliveryReadinessChannel[] {
  const env = getAppEnv();
  const emailReady = Boolean(env.mailjetApiKey && env.mailjetApiSecret);

  return [
    {
      channel: "manual",
      status: "ready",
      provider: "owner_console",
      blockers: [],
      nextActions: ["Manual owner-console verification delivery is available for document, admin, and fallback claim workflows."]
    },
    {
      channel: "email",
      status: emailReady ? "manual_only" : "blocked",
      provider: emailReady ? "mailjet_configuration_detected_pending_transactional_adapter" : "mailjet_not_configured",
      blockers: emailReady
        ? ["Mailjet credentials are configured, but the provider claim transactional email adapter is not enabled yet."]
        : ["MAILJET_API_KEY and MAILJET_API_SECRET are required before email verification delivery can leave manual mode."],
      nextActions: emailReady
        ? ["Wire provider claim verification templates to the transactional email adapter before live sends."]
        : ["Configure Mailjet credentials or keep business-email verification in manual delivery mode."]
    },
    {
      channel: "sms",
      status: "blocked",
      provider: "sms_adapter_not_configured",
      blockers: ["No SMS provider adapter is configured for business-phone verification delivery."],
      nextActions: ["Choose and configure an SMS provider before enabling live business-phone verification sends."]
    },
    {
      channel: "phone",
      status: "manual_only",
      provider: "owner_console_call_task",
      blockers: ["Automated outbound phone verification is not configured."],
      nextActions: ["Use owner-console call tasks for phone verification until a voice provider adapter is approved."]
    }
  ];
}

function deliveryReadinessForChannel(channel: ProviderVerificationDeliveryRecord["channel"]) {
  return verificationDeliveryChannels().find((item) => item.channel === channel) ?? verificationDeliveryChannels()[0];
}

export async function getProviderVerificationDeliveryReadiness(): Promise<ProviderVerificationDeliveryReadiness> {
  const channels = verificationDeliveryChannels();
  const blockers = channels.flatMap((channel) => channel.blockers);
  const liveReadyChannels = channels.filter((channel) => channel.channel !== "manual" && channel.status === "ready");

  return {
    generatedAt: new Date().toISOString(),
    status: liveReadyChannels.length ? "ready" : blockers.length ? "manual_only" : "ready",
    channels,
    blockers,
    nextActions: [
      "Keep provider verification sends in owner-console/manual mode until a channel reports ready.",
      ...channels.flatMap((channel) => channel.nextActions)
    ]
  };
}

export async function listProviderVerificationAttempts(claimId: string): Promise<ProviderVerificationAttemptRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedVerificationAttempts.filter((attempt) => attempt.providerClaimId === claimId);
  }

  const { data, error } = await supabase
    .from("provider_verification_attempts")
    .select("*")
    .eq("provider_claim_id", claimId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Provider verification attempt query failed: ${error.message}`);
  }

  return (data ?? []).map(mapVerificationAttempt);
}

export async function createProviderVerificationAttempt(
  input: CreateProviderVerificationAttemptInput
): Promise<ProviderVerificationAttemptRecord> {
  const policy = await runPolicyCheck({
    subjectType: "provider_verification_attempt",
    subjectId: input.claimId,
    actionKey: "create_provider_verification_attempt",
    input: {
      claimId: input.claimId,
      method: input.method,
      target: input.target,
      attemptPayload: input.attemptPayload
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider verification attempt blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const expiresAt = input.expiresAt ?? defaultExpiresAt(new Date(now));

  if (!supabase) {
    const existing = nonExpiredPendingAttempt(seedVerificationAttempts, input);

    if (existing) {
      return existing;
    }

    fallbackVerificationAttemptSequence += 1;
    const attempt: ProviderVerificationAttemptRecord = {
      id: `pending-verification-${Date.now()}-${fallbackVerificationAttemptSequence}`,
      providerClaimId: input.claimId,
      method: input.method,
      status: "pending",
      target: input.target,
      attemptPayload: input.attemptPayload ?? {},
      expiresAt,
      createdAt: now
    };
    seedVerificationAttempts.unshift(attempt);
    return attempt;
  }

  const { data: existing, error: existingError } = await supabase
    .from("provider_verification_attempts")
    .select("*")
    .eq("provider_claim_id", input.claimId)
    .eq("method", input.method)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);

  if (existingError) {
    throw new Error(`Provider verification attempt idempotency lookup failed: ${existingError.message}`);
  }

  const existingAttempt = (existing ?? []).map(mapVerificationAttempt).find((attempt) => !isExpiredPendingAttempt(attempt, new Date(now)));

  if (existingAttempt) {
    return existingAttempt;
  }

  const { data, error } = await supabase
    .from("provider_verification_attempts")
    .insert({
      provider_claim_id: input.claimId,
      method: input.method,
      status: "pending",
      target: input.target,
      attempt_payload: input.attemptPayload ?? {},
      expires_at: expiresAt
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider verification attempt creation failed: ${error.message}`);
  }

  const nextClaimStatus = methodToClaimStatus(input.method);

  await supabase
    .from("provider_claims")
    .update({ status: nextClaimStatus, verification_method: input.method, updated_at: now })
    .eq("id", input.claimId);

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "provider_verification_attempt.created",
    subject_type: "provider_claim",
    subject_id: input.claimId,
    payload: {
      attemptId: data.id,
      method: input.method,
      target: input.target,
      policyDecision: policy.decision
    }
  });

  return mapVerificationAttempt(data);
}

export async function expireProviderVerificationAttempts(input: {
  claimId?: string;
  actorId?: string;
  limit?: number;
} = {}): Promise<ProviderVerificationExpiryResult> {
  const now = new Date().toISOString();
  const limit = Math.max(1, Math.min(input.limit ?? 100, 250));
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const expired = seedVerificationAttempts
      .filter((attempt) => !input.claimId || attempt.providerClaimId === input.claimId)
      .filter((attempt) => isExpiredPendingAttempt(attempt))
      .slice(0, limit);

    for (const attempt of expired) {
      attempt.status = "expired";
      attempt.completedAt = now;
      attempt.attemptPayload = {
        ...attempt.attemptPayload,
        expiredBy: "verification_expiry_worker",
        expiredAt: now
      };
    }

    return {
      generatedAt: now,
      expired: expired.length,
      attempts: expired
    };
  }

  let query = supabase
    .from("provider_verification_attempts")
    .select("*")
    .eq("status", "pending")
    .lt("expires_at", now)
    .order("expires_at", { ascending: true })
    .limit(limit);

  if (input.claimId) {
    query = query.eq("provider_claim_id", input.claimId);
  }

  const { data: expiredRows, error: lookupError } = await query;

  if (lookupError) {
    throw new Error(`Provider verification expiry lookup failed: ${lookupError.message}`);
  }

  const expired = (expiredRows ?? []).map(mapVerificationAttempt);

  if (expired.length === 0) {
    return {
      generatedAt: now,
      expired: 0,
      attempts: []
    };
  }

  const { error: updateError } = await supabase
    .from("provider_verification_attempts")
    .update({
      status: "expired",
      completed_at: now
    })
    .in("id", expired.map((attempt) => attempt.id));

  if (updateError) {
    throw new Error(`Provider verification expiry update failed: ${updateError.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "provider_verification_attempts.expired",
    subject_type: "provider_verification_attempt",
    payload: {
      expiredAttemptIds: expired.map((attempt) => attempt.id),
      claimId: input.claimId,
      expired: expired.length
    }
  });

  return {
    generatedAt: now,
    expired: expired.length,
    attempts: expired.map((attempt) => ({
      ...attempt,
      status: "expired" as const,
      completedAt: now
    }))
  };
}

export async function completeProviderVerificationAttempt(
  input: CompleteProviderVerificationAttemptInput
): Promise<ProviderVerificationAttemptRecord> {
  const policy = await runPolicyCheck({
    subjectType: "provider_verification_attempt",
    subjectId: input.attemptId,
    actionKey: "complete_provider_verification_attempt",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider verification completion blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const existing = seedVerificationAttempts.find((attempt) => attempt.id === input.attemptId);

    if (!existing) {
      throw new Error("Provider verification attempt not found");
    }

    assertAttemptCanBeCompleted(existing, new Date(now));

    const completed: ProviderVerificationAttemptRecord = {
      id: input.attemptId,
      providerClaimId: existing.providerClaimId,
      method: existing.method,
      status: input.status,
      target: existing.target,
      attemptPayload: { ...existing.attemptPayload, completionEvidence: input.evidence ?? {} },
      expiresAt: existing.expiresAt,
      completedAt: now,
      createdAt: existing.createdAt
    };

    Object.assign(existing, completed);

    return completed;
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("provider_verification_attempts")
    .select("*")
    .eq("id", input.attemptId)
    .single();

  if (attemptError) {
    throw new Error(`Provider verification attempt lookup failed: ${attemptError.message}`);
  }

  const mappedAttempt = mapVerificationAttempt(attempt);
  assertAttemptCanBeCompleted(mappedAttempt, new Date(now));

  const attemptPayload = {
    ...mapJson(attempt.attempt_payload),
    completionEvidence: input.evidence ?? {}
  };

  const { data, error } = await supabase
    .from("provider_verification_attempts")
    .update({
      status: input.status,
      attempt_payload: attemptPayload,
      completed_at: now
    })
    .eq("id", input.attemptId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider verification attempt completion failed: ${error.message}`);
  }

  if (input.status === "passed") {
    await supabase
      .from("provider_claims")
      .update({
        status: "admin_review",
        verification_payload: attemptPayload,
        updated_at: now
      })
      .eq("id", attempt.provider_claim_id);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: `provider_verification_attempt.${input.status}`,
    subject_type: "provider_verification_attempt",
    subject_id: input.attemptId,
    payload: {
      claimId: attempt.provider_claim_id,
      method: attempt.method,
      evidence: input.evidence ?? {},
      policyDecision: policy.decision
    }
  });

  return mapVerificationAttempt(data);
}

export async function sendProviderVerificationAttempt(
  input: SendProviderVerificationAttemptInput
): Promise<ProviderVerificationDeliveryRecord> {
  const supabase = getSupabaseAdminClient();
  const attempt = supabase
    ? await getSupabaseVerificationAttempt(input.attemptId)
    : seedVerificationAttempts.find((item) => item.id === input.attemptId);

  if (!attempt) {
    throw new Error("Provider verification attempt not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "provider_verification_attempt",
    subjectId: input.attemptId,
    actionKey: "send_provider_verification_attempt",
    input: {
      ...input,
      method: attempt.method,
      providerClaimId: attempt.providerClaimId
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider verification delivery blocked by policy");
  }

  const delivery = buildDeliveryRecord(attempt, input, policy.decision);
  const updatedPayload = {
    ...attempt.attemptPayload,
    delivery
  };

  if (!supabase) {
    Object.assign(attempt, { attemptPayload: updatedPayload });
    return delivery;
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("provider_verification_attempts")
    .update({
      attempt_payload: updatedPayload
    })
    .eq("id", input.attemptId);

  if (error) {
    throw new Error(`Provider verification delivery update failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "provider_verification_attempt.delivery_sent",
    subject_type: "provider_verification_attempt",
    subject_id: input.attemptId,
    payload: {
      claimId: attempt.providerClaimId,
      method: attempt.method,
      channel: delivery.channel,
      target: delivery.target,
      deliveryStatus: delivery.status,
      policyDecision: policy.decision,
      sentAt: delivery.sentAt ?? now
    }
  });

  return delivery;
}

export async function issueProviderVerificationCode(
  input: IssueProviderVerificationCodeInput
): Promise<ProviderVerificationCodeDeliveryRecord> {
  const supabase = getSupabaseAdminClient();
  const attempt = supabase
    ? await getSupabaseVerificationAttempt(input.attemptId)
    : seedVerificationAttempts.find((item) => item.id === input.attemptId);

  if (!attempt) {
    throw new Error("Provider verification attempt not found");
  }

  assertAttemptCanBeCompleted(attempt);
  assertCodeMethod(attempt);

  const policy = await runPolicyCheck({
    subjectType: "provider_verification_attempt",
    subjectId: input.attemptId,
    actionKey: "issue_provider_verification_code",
    input: {
      ...input,
      method: attempt.method,
      providerClaimId: attempt.providerClaimId
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider verification code issue blocked by policy");
  }

  const code = generateVerificationCode();
  const codeExpiresAt = new Date(Date.now() + verificationCodeTtlMs).toISOString();
  const delivery = buildCodeDeliveryRecord(attempt, input, code, codeExpiresAt, policy.decision);
  const updatedPayload = {
    ...attempt.attemptPayload,
    codeVerification: {
      codeHash: hashVerificationCode(attempt.id, code),
      codeExpiresAt,
      issuedAt: new Date().toISOString(),
      issuedBy: input.actorId,
      attempts: 0,
      channel: delivery.channel,
      target: input.target ?? attempt.target
    },
    delivery: {
      ...delivery,
      manualCode: undefined
    }
  };

  if (!supabase) {
    Object.assign(attempt, { attemptPayload: updatedPayload });
    return delivery;
  }

  const { error } = await supabase
    .from("provider_verification_attempts")
    .update({ attempt_payload: updatedPayload })
    .eq("id", input.attemptId);

  if (error) {
    throw new Error(`Provider verification code update failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "provider_verification_attempt.code_issued",
    subject_type: "provider_verification_attempt",
    subject_id: input.attemptId,
    payload: {
      claimId: attempt.providerClaimId,
      method: attempt.method,
      channel: delivery.channel,
      target: delivery.target,
      codeExpiresAt,
      policyDecision: policy.decision
    }
  });

  return delivery;
}

export async function confirmProviderVerificationCode(
  input: ConfirmProviderVerificationCodeInput
): Promise<ProviderVerificationAttemptRecord> {
  const supabase = getSupabaseAdminClient();
  const attempt = supabase
    ? await getSupabaseVerificationAttempt(input.attemptId)
    : seedVerificationAttempts.find((item) => item.id === input.attemptId);

  if (!attempt) {
    throw new Error("Provider verification attempt not found");
  }

  assertAttemptCanBeCompleted(attempt);
  assertCodeMethod(attempt);

  const codeVerification = mapJson(attempt.attemptPayload.codeVerification);
  const codeHash = getString(codeVerification.codeHash);
  const codeExpiresAt = getString(codeVerification.codeExpiresAt);
  const attempts = typeof codeVerification.attempts === "number" ? codeVerification.attempts : 0;

  if (!codeHash || !codeExpiresAt) {
    throw new Error("No active verification code has been issued for this attempt");
  }

  if (Date.parse(codeExpiresAt) <= Date.now()) {
    throw new Error("Provider verification code has expired; issue a new code");
  }

  if (attempts >= 5) {
    throw new Error("Provider verification code attempt limit exceeded; issue a new code");
  }

  const submittedHash = hashVerificationCode(attempt.id, input.code);

  if (submittedHash !== codeHash) {
    const updatedPayload = {
      ...attempt.attemptPayload,
      codeVerification: {
        ...codeVerification,
        attempts: attempts + 1,
        lastFailedAt: new Date().toISOString()
      }
    };

    if (!supabase) {
      Object.assign(attempt, { attemptPayload: updatedPayload });
    } else {
      await supabase.from("provider_verification_attempts").update({ attempt_payload: updatedPayload }).eq("id", attempt.id);
    }

    throw new Error("Verification code is invalid");
  }

  return completeProviderVerificationAttempt({
    attemptId: attempt.id,
    status: "passed",
    evidence: {
      evidenceType: attempt.method,
      codeVerifiedAt: new Date().toISOString(),
      codeChannel: codeVerification.channel,
      codeTarget: codeVerification.target
    },
    actorId: input.actorId
  });
}

async function getSupabaseVerificationAttempt(attemptId: string): Promise<ProviderVerificationAttemptRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) return null;

  const { data, error } = await supabase
    .from("provider_verification_attempts")
    .select("*")
    .eq("id", attemptId)
    .maybeSingle();

  if (error) {
    throw new Error(`Provider verification attempt lookup failed: ${error.message}`);
  }

  return data ? mapVerificationAttempt(data) : null;
}
