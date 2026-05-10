import type { ProviderClaimDecisionInput, ProviderClaimInput, ProviderClaimRecord } from "@/lib/domain/claims";
import { createProviderVerificationAttempt } from "@/lib/claims/provider-verification";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedClaims: ProviderClaimRecord[] = [];

function mapProviderClaim(row: Record<string, unknown>): ProviderClaimRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    claimantName: String(row.claimant_name),
    claimantEmail: String(row.claimant_email),
    claimantPhone: row.claimant_phone ? String(row.claimant_phone) : undefined,
    claimantRole: row.claimant_role ? String(row.claimant_role) : undefined,
    businessDomain: row.business_domain ? String(row.business_domain) : undefined,
    status: row.status as ProviderClaimRecord["status"],
    verificationMethod: row.verification_method as ProviderClaimRecord["verificationMethod"],
    policyCheckId: row.policy_check_id ? String(row.policy_check_id) : undefined,
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

export async function listProviderClaims(): Promise<ProviderClaimRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedClaims;
  }

  const { data, error } = await supabase.from("provider_claims").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Provider claim query failed: ${error.message}`);
  }

  return (data ?? []).map(mapProviderClaim);
}

export async function submitProviderClaim(input: ProviderClaimInput): Promise<ProviderClaimRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "provider_claim",
    subjectId: input.providerId,
    actionKey: "submit_provider_claim",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider claim blocked by policy");
  }

  const nextStatus = input.businessDomain ? "email_pending" : "admin_review";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const claim: ProviderClaimRecord = {
      id: `pending-claim-${Date.now()}`,
      ...input,
      status: nextStatus,
      verificationMethod: input.businessDomain ? "business_email" : "admin_manual",
      createdAt: new Date().toISOString()
    };
    seedClaims.unshift(claim);
    await createProviderVerificationAttempt({
      claimId: claim.id,
      method: claim.verificationMethod ?? "admin_manual",
      target: claim.businessDomain ?? claim.claimantEmail,
      attemptPayload: { source: "claim_submission", providerId: input.providerId },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    return claim;
  }

  const { data, error } = await supabase
    .from("provider_claims")
    .insert({
      provider_id: input.providerId,
      claimant_name: input.claimantName,
      claimant_email: input.claimantEmail,
      claimant_phone: input.claimantPhone,
      claimant_role: input.claimantRole,
      business_domain: input.businessDomain,
      status: nextStatus,
      verification_method: input.businessDomain ? "business_email" : "admin_manual"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider claim submission failed: ${error.message}`);
  }

  await createProviderVerificationAttempt({
    claimId: data.id,
    method: input.businessDomain ? "business_email" : "admin_manual",
    target: input.businessDomain ?? input.claimantEmail,
    attemptPayload: { source: "claim_submission", providerId: input.providerId },
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  });

  return mapProviderClaim(data);
}

export async function decideProviderClaim(input: ProviderClaimDecisionInput) {
  const policy = await runPolicyCheck({
    subjectType: "provider_claim",
    subjectId: input.claimId,
    actionKey: `${input.decision}_provider_claim`,
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider claim decision blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return {
      id: input.claimId,
      status: input.decision,
      adminNotes: input.adminNotes,
      decidedAt: now,
      providerStatus: input.decision === "approved" ? "claimed" : undefined
    };
  }

  const { data: claim, error: claimError } = await supabase
    .from("provider_claims")
    .select("*")
    .eq("id", input.claimId)
    .single();

  if (claimError) {
    throw new Error(`Provider claim lookup failed: ${claimError.message}`);
  }

  const updatePayload =
    input.decision === "approved"
      ? { status: "approved", admin_notes: input.adminNotes, approved_at: now, updated_at: now }
      : { status: "rejected", admin_notes: input.adminNotes, rejected_at: now, updated_at: now };

  const { data: updatedClaim, error: updateError } = await supabase
    .from("provider_claims")
    .update(updatePayload)
    .eq("id", input.claimId)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(`Provider claim update failed: ${updateError.message}`);
  }

  if (input.decision === "approved") {
    const { error: providerError } = await supabase
      .from("providers")
      .update({ status: "claimed", claimed_at: now, updated_at: now })
      .eq("id", claim.provider_id);

    if (providerError) {
      throw new Error(`Provider claim status update failed: ${providerError.message}`);
    }
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: `provider_claim.${input.decision}`,
    subject_type: "provider_claim",
    subject_id: input.claimId,
    payload: {
      providerId: claim.provider_id,
      adminNotes: input.adminNotes,
      policyDecision: policy.decision
    }
  });

  return mapProviderClaim(updatedClaim);
}

export async function getProviderClaimById(claimId: string): Promise<ProviderClaimRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedClaims.find((claim) => claim.id === claimId) ?? null;
  }

  const { data, error } = await supabase.from("provider_claims").select("*").eq("id", claimId).maybeSingle();

  if (error) {
    throw new Error(`Provider claim lookup failed: ${error.message}`);
  }

  return data ? mapProviderClaim(data) : null;
}
