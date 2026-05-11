import type {
  CompleteProviderVerificationAttemptInput,
  CreateProviderVerificationAttemptInput,
  ProviderClaimStatus,
  ProviderVerificationDeliveryRecord,
  ProviderVerificationAttemptRecord,
  ProviderVerificationExpiryResult,
  ProviderVerificationMethod,
  SendProviderVerificationAttemptInput
} from "@/lib/domain/claims";
import { getAppEnv } from "@/lib/env";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedVerificationAttempts: ProviderVerificationAttemptRecord[] = [];
const verificationTtlMs = 7 * 24 * 60 * 60 * 1000;

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
  const sentAt = channel === "manual" ? undefined : new Date().toISOString();

  return {
    attemptId: attempt.id,
    status: channel === "manual" || !target ? "manual_required" : "sent",
    channel,
    target,
    actionUrl: buildVerificationActionUrl(attempt),
    sentAt,
    deliveryPayload: {
      messageTemplate: input.messageTemplate ?? "provider_claim_verification",
      policyDecision,
      providerClaimId: attempt.providerClaimId,
      method: attempt.method,
      deliveryProvider: channel === "manual" ? "owner_console" : "configured_messaging_adapter_pending"
    }
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

    const attempt: ProviderVerificationAttemptRecord = {
      id: `pending-verification-${Date.now()}`,
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
