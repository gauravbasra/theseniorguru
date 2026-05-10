import type { ProviderContactIntent, ProviderContactRecord } from "@/lib/domain/contact";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

function mapContact(row: Record<string, unknown>): ProviderContactRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    requesterName: String(row.requester_name),
    requesterEmail: row.requester_email ? String(row.requester_email) : undefined,
    requesterPhone: row.requester_phone ? String(row.requester_phone) : undefined,
    relationship: row.relationship as ProviderContactRecord["relationship"],
    payingWith: row.paying_with as ProviderContactRecord["payingWith"],
    message: row.message ? String(row.message) : undefined,
    consentToContact: Boolean(row.consent_to_contact),
    status: row.status as ProviderContactRecord["status"],
    policyDecision: String(row.policy_decision ?? "approved"),
    createdAt: String(row.created_at)
  };
}

export async function submitProviderContactIntent(input: ProviderContactIntent): Promise<ProviderContactRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  if (!input.requesterEmail && !input.requesterPhone) {
    return {
      id: `pending-contact-${Date.now()}`,
      ...input,
      status: "needs_contact_info",
      policyDecision: "approved",
      createdAt: new Date().toISOString()
    };
  }

  const policy = await runPolicyCheck({
    subjectType: "provider_contact",
    subjectId: input.providerId,
    actionKey: "submit_provider_contact",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    return {
      id: `blocked-contact-${Date.now()}`,
      ...input,
      status: "blocked_by_policy",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    };
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-contact-${Date.now()}`,
      ...input,
      status: "submitted",
      policyDecision: policy.decision,
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("provider_contact_intents")
    .insert({
      provider_id: input.providerId,
      requester_name: input.requesterName,
      requester_email: input.requesterEmail,
      requester_phone: input.requesterPhone,
      relationship: input.relationship,
      paying_with: input.payingWith,
      message: input.message,
      consent_to_contact: input.consentToContact,
      status: "submitted",
      policy_decision: policy.decision
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider contact submission failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_type: "family",
    event_type: "provider_contact.submitted",
    subject_type: "provider",
    subject_id: input.providerId,
    payload: {
      providerName: provider.name,
      relationship: input.relationship,
      payingWith: input.payingWith,
      policyDecision: policy.decision
    }
  });

  return mapContact(data);
}
