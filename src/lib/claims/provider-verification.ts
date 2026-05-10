import type {
  CompleteProviderVerificationAttemptInput,
  CreateProviderVerificationAttemptInput,
  ProviderClaimStatus,
  ProviderVerificationAttemptRecord,
  ProviderVerificationMethod
} from "@/lib/domain/claims";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedVerificationAttempts: ProviderVerificationAttemptRecord[] = [];

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

  if (!supabase) {
    const attempt: ProviderVerificationAttemptRecord = {
      id: `pending-verification-${Date.now()}`,
      providerClaimId: input.claimId,
      method: input.method,
      status: "pending",
      target: input.target,
      attemptPayload: input.attemptPayload ?? {},
      expiresAt: input.expiresAt,
      createdAt: now
    };
    seedVerificationAttempts.unshift(attempt);
    return attempt;
  }

  const { data, error } = await supabase
    .from("provider_verification_attempts")
    .insert({
      provider_claim_id: input.claimId,
      method: input.method,
      status: "pending",
      target: input.target,
      attempt_payload: input.attemptPayload ?? {},
      expires_at: input.expiresAt
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
    const completed: ProviderVerificationAttemptRecord = {
      id: input.attemptId,
      providerClaimId: existing?.providerClaimId ?? "fallback-claim",
      method: existing?.method ?? "admin_manual",
      status: input.status,
      target: existing?.target,
      attemptPayload: { ...(existing?.attemptPayload ?? {}), completionEvidence: input.evidence ?? {} },
      completedAt: now,
      createdAt: existing?.createdAt ?? now
    };

    if (existing) {
      Object.assign(existing, completed);
    }

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
