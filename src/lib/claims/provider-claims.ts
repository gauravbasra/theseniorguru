import type { ProviderClaimInput, ProviderClaimRecord } from "@/lib/domain/claims";
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
    return {
      id: `pending-claim-${Date.now()}`,
      ...input,
      status: nextStatus,
      verificationMethod: input.businessDomain ? "business_email" : "admin_manual",
      createdAt: new Date().toISOString()
    };
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

  return mapProviderClaim(data);
}

