import type { ProviderPortalUpdateInput, ProviderPortalUpdateResult } from "@/lib/domain/providers";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const editableFields = [
  "displayName",
  "phone",
  "websiteUrl",
  "summary",
  "categories",
  "availability",
  "pricing"
] as const;

function getChangedFields(input: ProviderPortalUpdateInput): string[] {
  return editableFields.filter((field) => input[field] !== undefined);
}

export async function submitProviderPortalUpdate(
  input: ProviderPortalUpdateInput
): Promise<ProviderPortalUpdateResult> {
  if (!input.attestationAccepted) {
    throw new Error("Provider attestation is required before submitting profile changes");
  }

  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const changedFields = getChangedFields(input);

  if (!changedFields.length) {
    throw new Error("At least one editable provider field is required");
  }

  const policy = await runPolicyCheck({
    subjectType: "provider_profile_update",
    subjectId: provider.id,
    actionKey: "submit_provider_profile_update",
    input: {
      ...input,
      providerName: provider.name,
      currentStatus: provider.status
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    return {
      id: `blocked-provider-update-${Date.now()}`,
      providerId: provider.id,
      status: "blocked_by_policy",
      changedFields,
      policyDecision: policy.decision,
      requiredDisclosures: policy.requiredDisclosures,
      createdAt: new Date().toISOString()
    };
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    return {
      id: `pending-provider-update-${Date.now()}`,
      providerId: provider.id,
      status: "pending_review",
      changedFields,
      policyDecision: policy.decision,
      requiredDisclosures: policy.requiredDisclosures,
      createdAt: now
    };
  }

  const { data, error } = await supabase
    .from("provider_profile_audits")
    .insert({
      provider_id: provider.id,
      actor_id: input.actorId,
      change_type: "provider_portal_update",
      changed_fields: changedFields,
      proposed_payload: {
        displayName: input.displayName,
        phone: input.phone,
        websiteUrl: input.websiteUrl,
        summary: input.summary,
        categories: input.categories,
        availability: input.availability,
        pricing: input.pricing
      },
      policy_decision: policy.decision,
      status: "pending_review"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider profile audit creation failed: ${error.message}`);
  }

  return {
    id: String(data.id),
    providerId: provider.id,
    status: "pending_review",
    changedFields,
    policyDecision: policy.decision,
    requiredDisclosures: policy.requiredDisclosures,
    createdAt: String(data.created_at ?? now)
  };
}
