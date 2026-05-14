import { recordAuditEvent } from "@/lib/audit-events";
import { seedProviders } from "@/lib/data/seed";
import type {
  ProviderProfileAuditRecord,
  ProviderProfileUpdateDecisionInput,
  ProviderProfileUpdateDecisionResult,
  ProviderProfileUpdateQueueSummary,
  ProviderProfileUpdateStatusSummary,
  ProviderPortalUpdateInput,
  ProviderPortalUpdateResult
} from "@/lib/domain/providers";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const localProfileAudits: ProviderProfileAuditRecord[] = [];

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

function mapTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function mapProviderProfileAudit(row: Record<string, unknown>): ProviderProfileAuditRecord {
  const provider = row.providers && typeof row.providers === "object" ? (row.providers as Record<string, unknown>) : undefined;

  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    providerName: provider?.name ? String(provider.name) : undefined,
    actorId: row.actor_id ? String(row.actor_id) : undefined,
    changeType: String(row.change_type),
    changedFields: mapTextArray(row.changed_fields),
    proposedPayload:
      row.proposed_payload && typeof row.proposed_payload === "object"
        ? (row.proposed_payload as Record<string, unknown>)
        : {},
    policyDecision: row.policy_decision as ProviderProfileAuditRecord["policyDecision"],
    status: row.status as ProviderProfileAuditRecord["status"],
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined
  };
}

function patchProviderInMemory(audit: ProviderProfileAuditRecord) {
  const provider = seedProviders.find((item) => item.id === audit.providerId);
  const payload = audit.proposedPayload;
  const appliedFields: string[] = [];

  if (!provider) {
    return appliedFields;
  }

  if (typeof payload.displayName === "string" && payload.displayName.trim()) {
    provider.name = payload.displayName.trim();
    appliedFields.push("displayName");
  }

  if (typeof payload.phone === "string") {
    provider.phone = payload.phone;
    appliedFields.push("phone");
  }

  if (typeof payload.websiteUrl === "string") {
    provider.websiteUrl = payload.websiteUrl;
    appliedFields.push("websiteUrl");
  }

  if (typeof payload.summary === "string") {
    provider.summary = payload.summary;
    appliedFields.push("summary");
  }

  if (Array.isArray(payload.categories)) {
    provider.categories = payload.categories.map(String).filter(Boolean);
    appliedFields.push("categories");
  }

  return appliedFields;
}

function providerUpdatePayload(audit: ProviderProfileAuditRecord) {
  const payload = audit.proposedPayload;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const appliedFields: string[] = [];
  const skippedFields: string[] = [];

  if (typeof payload.displayName === "string" && payload.displayName.trim()) {
    update.name = payload.displayName.trim();
    appliedFields.push("displayName");
  }

  if (typeof payload.phone === "string") {
    update.phone = payload.phone;
    appliedFields.push("phone");
  }

  if (typeof payload.websiteUrl === "string") {
    update.website_url = payload.websiteUrl;
    appliedFields.push("websiteUrl");
  }

  if (typeof payload.summary === "string") {
    update.short_description = payload.summary;
    appliedFields.push("summary");
  }

  if (Array.isArray(payload.categories)) {
    skippedFields.push("categories");
  }

  if (payload.availability && typeof payload.availability === "object") {
    skippedFields.push("availability");
  }

  if (payload.pricing && typeof payload.pricing === "object") {
    skippedFields.push("pricing");
  }

  return { update, appliedFields, skippedFields };
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
    const audit: ProviderProfileAuditRecord = {
      id: `pending-provider-update-${Date.now()}`,
      providerId: provider.id,
      providerName: provider.name,
      actorId: input.actorId,
      changeType: "provider_portal_update",
      changedFields,
      proposedPayload: {
        displayName: input.displayName,
        phone: input.phone,
        websiteUrl: input.websiteUrl,
        summary: input.summary,
        categories: input.categories,
        availability: input.availability,
        pricing: input.pricing
      },
      policyDecision: policy.decision,
      status: "pending_review",
      createdAt: now
    };

    localProfileAudits.unshift(audit);

    return {
      id: audit.id,
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

export async function getProviderProfileUpdateQueue(): Promise<ProviderProfileUpdateQueueSummary> {
  const supabase = getSupabaseAdminClient();
  const audits = supabase
    ? await (async () => {
        const { data, error } = await supabase
          .from("provider_profile_audits")
          .select("*, providers(name)")
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          throw new Error(`Provider profile update queue query failed: ${error.message}`);
        }

        return (data ?? []).map(mapProviderProfileAudit);
      })()
    : localProfileAudits;
  const pendingReview = audits.filter((audit) => audit.status === "pending_review");
  const applied = audits.filter((audit) => audit.status === "applied" || audit.status === "approved");
  const rejected = audits.filter((audit) => audit.status === "rejected");

  return {
    generatedAt: new Date().toISOString(),
    totals: {
      updates: audits.length,
      pendingReview: pendingReview.length,
      applied: applied.length,
      rejected: rejected.length
    },
    pendingReview,
    applied,
    rejected,
    nextActions: [
      ...(pendingReview.length ? ["Review claimed-provider profile edits before they alter public listing content."] : []),
      ...(!audits.length ? ["Provider portal edits will appear here after claimed operators submit attested changes."] : []),
      ...(applied.length ? ["Applied edits remain visible in the audit queue for launch review traceability."] : [])
    ]
  };
}

export async function getProviderProfileUpdateStatus(providerId: string): Promise<ProviderProfileUpdateStatusSummary> {
  const provider = await getProviderById(providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const supabase = getSupabaseAdminClient();
  const updates = supabase
    ? await (async () => {
        const { data, error } = await supabase
          .from("provider_profile_audits")
          .select("*, providers(name)")
          .eq("provider_id", provider.id)
          .order("created_at", { ascending: false })
          .limit(25);

        if (error) {
          throw new Error(`Provider profile update status query failed: ${error.message}`);
        }

        return (data ?? []).map(mapProviderProfileAudit);
      })()
    : localProfileAudits.filter((audit) => audit.providerId === provider.id);
  const pendingReview = updates.filter((audit) => audit.status === "pending_review");
  const applied = updates.filter((audit) => audit.status === "applied" || audit.status === "approved");
  const rejected = updates.filter((audit) => audit.status === "rejected");
  const latestStatus = updates[0]?.status ?? "not_started";

  return {
    generatedAt: new Date().toISOString(),
    providerId: provider.id,
    providerName: provider.name,
    totals: {
      updates: updates.length,
      pendingReview: pendingReview.length,
      applied: applied.length,
      rejected: rejected.length
    },
    latestStatus,
    updates,
    nextActions: [
      ...(pendingReview.length ? ["Your latest profile changes are pending Senior Guru review before they appear publicly."] : []),
      ...(latestStatus === "applied" || latestStatus === "approved" ? ["Your latest approved profile changes are now reflected in the public directory."] : []),
      ...(latestStatus === "rejected" ? ["Review the admin notes, correct the profile change, and submit a new attested update."] : []),
      ...(!updates.length ? ["Submit an attested provider profile update to start the review workflow."] : [])
    ]
  };
}

export async function decideProviderProfileUpdate(
  input: ProviderProfileUpdateDecisionInput
): Promise<ProviderProfileUpdateDecisionResult> {
  const policy = await runPolicyCheck({
    subjectType: "provider_profile_update",
    subjectId: input.auditId,
    actionKey: `${input.decision}_provider_profile_update`,
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider profile update decision blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const audit = localProfileAudits.find((item) => item.id === input.auditId);

    if (!audit) {
      throw new Error("Provider profile update audit not found");
    }

    if (audit.status !== "pending_review") {
      throw new Error("Provider profile update audit is already decided");
    }

    const appliedFields = input.decision === "approve" ? patchProviderInMemory(audit) : [];
    const skippedFields = audit.changedFields.filter((field) => !appliedFields.includes(field));
    audit.status = input.decision === "approve" ? "applied" : "rejected";
    audit.reviewerNotes = input.reviewerNotes;
    audit.reviewedAt = now;

    await recordAuditEvent({
      actorId: input.reviewerId,
      actorType: input.reviewerId ? "admin" : "system",
      eventType: `provider_profile_update.${input.decision === "approve" ? "applied" : "rejected"}`,
      subjectType: "provider_profile_audit",
      subjectId: audit.id,
      payload: {
        providerId: audit.providerId,
        changedFields: audit.changedFields,
        appliedFields,
        skippedFields,
        reviewerNotes: input.reviewerNotes,
        policyDecision: policy.decision
      }
    });

    return {
      audit,
      appliedFields,
      skippedFields,
      nextActions: appliedFields.length
        ? ["Provider profile edits were applied and recorded in the audit trail."]
        : ["Provider profile update decision was recorded without public listing changes."]
    };
  }

  const { data: auditRow, error: auditError } = await supabase
    .from("provider_profile_audits")
    .select("*, providers(name)")
    .eq("id", input.auditId)
    .single();

  if (auditError) {
    throw new Error(`Provider profile update audit lookup failed: ${auditError.message}`);
  }

  const audit = mapProviderProfileAudit(auditRow);

  if (audit.status !== "pending_review") {
    throw new Error("Provider profile update audit is already decided");
  }

  const { update, appliedFields, skippedFields } = input.decision === "approve"
    ? providerUpdatePayload(audit)
    : { update: {}, appliedFields: [], skippedFields: audit.changedFields };

  if (input.decision === "approve" && appliedFields.length) {
    const { error: providerError } = await supabase.from("providers").update(update).eq("id", audit.providerId);

    if (providerError) {
      throw new Error(`Provider profile update apply failed: ${providerError.message}`);
    }
  }

  const { data: updatedAudit, error: updateError } = await supabase
    .from("provider_profile_audits")
    .update({
      status: input.decision === "approve" ? "applied" : "rejected",
      reviewer_notes: input.reviewerNotes,
      reviewed_at: now
    })
    .eq("id", input.auditId)
    .select("*, providers(name)")
    .single();

  if (updateError) {
    throw new Error(`Provider profile update audit decision failed: ${updateError.message}`);
  }

  await recordAuditEvent({
    actorId: input.reviewerId,
    actorType: input.reviewerId ? "admin" : "system",
    eventType: `provider_profile_update.${input.decision === "approve" ? "applied" : "rejected"}`,
    subjectType: "provider_profile_audit",
    subjectId: input.auditId,
    payload: {
      providerId: audit.providerId,
      changedFields: audit.changedFields,
      appliedFields,
      skippedFields,
      reviewerNotes: input.reviewerNotes,
      policyDecision: policy.decision
    }
  });

  return {
    audit: mapProviderProfileAudit(updatedAudit),
    appliedFields,
    skippedFields,
    nextActions: appliedFields.length
      ? ["Provider profile edits were applied and recorded in the audit trail."]
      : ["Provider profile update decision was recorded without public listing changes."]
  };
}
