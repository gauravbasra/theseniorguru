import type {
  ExternalReviewIntegrationRecord,
  ExternalReviewIntegrationSource,
  ExternalReviewIntegrationStatus,
  ExternalReviewIntegrationSummary,
  UpsertExternalReviewIntegrationInput
} from "@/lib/domain/reviews";
import { recordAuditEvent } from "@/lib/audit-events";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const sourceCatalog: Record<ExternalReviewIntegrationSource, { label: string; syncMode: ExternalReviewIntegrationRecord["syncMode"] }> = {
  google_business_profile: { label: "Google Business Profile", syncMode: "read_only_api" },
  caring_com: { label: "Caring.com", syncMode: "manual_export" },
  facebook: { label: "Facebook Reviews", syncMode: "read_only_api" },
  a_place_for_mom: { label: "A Place for Mom", syncMode: "manual_export" }
};

const seedExternalReviewIntegrations: ExternalReviewIntegrationRecord[] = [];

function nowIso() {
  return new Date().toISOString();
}

function sourceLabel(source: ExternalReviewIntegrationSource) {
  return sourceCatalog[source]?.label ?? source;
}

function integrationStatus(input: {
  source: ExternalReviewIntegrationSource;
  enabled?: boolean;
  credentialReference?: string;
}): { status: ExternalReviewIntegrationStatus; blockers: string[] } {
  if (input.enabled === false) {
    return { status: "disabled", blockers: ["External review sync is disabled for this source."] };
  }

  if (!input.credentialReference) {
    return {
      status: "owner_action_required",
      blockers: [`${sourceLabel(input.source)} requires provider-owned credential approval before live review sync.`]
    };
  }

  return { status: "credential_ready", blockers: [] };
}

function placeholderIntegration(providerId: string, source: ExternalReviewIntegrationSource): ExternalReviewIntegrationRecord {
  const readiness = integrationStatus({ source });

  return {
    id: `external-review-integration-${providerId}-${source}`,
    providerId,
    source,
    sourceLabel: sourceLabel(source),
    status: readiness.status,
    syncMode: sourceCatalog[source].syncMode,
    reviewCount: 0,
    blockers: readiness.blockers,
    payload: { credentialOwner: "provider", liveSyncAllowed: false },
    createdAt: nowIso()
  };
}

function mapIntegration(row: Record<string, unknown>): ExternalReviewIntegrationRecord {
  const source = row.source as ExternalReviewIntegrationSource;

  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    source,
    sourceLabel: sourceLabel(source),
    status: row.status as ExternalReviewIntegrationStatus,
    syncMode: (row.sync_mode as ExternalReviewIntegrationRecord["syncMode"]) ?? sourceCatalog[source].syncMode,
    credentialReference: row.credential_reference ? String(row.credential_reference) : undefined,
    lastSyncAt: row.last_sync_at ? String(row.last_sync_at) : undefined,
    lastSyncStatus: row.last_sync_status ? String(row.last_sync_status) : undefined,
    reviewCount: Number(row.review_count ?? 0),
    averageRating: row.average_rating === null || row.average_rating === undefined ? undefined : Number(row.average_rating),
    blockers: Array.isArray(row.blockers) ? row.blockers.map(String) : [],
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
    createdAt: String(row.created_at ?? nowIso()),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function mergeWithRequiredSources(providerId: string, records: ExternalReviewIntegrationRecord[]) {
  const bySource = new Map(records.map((record) => [record.source, record]));

  return (Object.keys(sourceCatalog) as ExternalReviewIntegrationSource[]).map((source) =>
    bySource.get(source) ?? placeholderIntegration(providerId, source)
  );
}

function summarizeIntegrations(
  providerId: string,
  providerName: string | undefined,
  integrations: ExternalReviewIntegrationRecord[]
): ExternalReviewIntegrationSummary {
  const connected = integrations.filter((integration) =>
    ["credential_ready", "sync_ready"].includes(integration.status)
  ).length;
  const actionRequired = integrations.filter((integration) => integration.status === "owner_action_required").length;
  const syncReady = integrations.filter((integration) => integration.status === "sync_ready").length;
  const blockers = integrations.flatMap((integration) => integration.blockers);

  return {
    generatedAt: nowIso(),
    providerId,
    providerName,
    status: connected > 0 ? (blockers.length ? "action_required" : "ready") : "not_configured",
    integrations,
    totals: {
      sources: integrations.length,
      connected,
      actionRequired,
      syncReady
    },
    blockers,
    nextActions: blockers.length
      ? ["Collect provider-owned credentials and source approvals before enabling external review sync."]
      : ["External review sources are credential-ready; schedule read-only sync and moderation monitoring."]
  };
}

export async function getExternalReviewIntegrationSummary(providerId: string): Promise<ExternalReviewIntegrationSummary> {
  const provider = await getProviderById(providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return summarizeIntegrations(
      provider.id,
      provider.name,
      mergeWithRequiredSources(provider.id, seedExternalReviewIntegrations.filter((integration) => integration.providerId === provider.id))
    );
  }

  const { data, error } = await supabase
    .from("external_review_integrations")
    .select("*")
    .eq("provider_id", provider.id)
    .order("source", { ascending: true });

  if (error) {
    throw new Error(`External review integration query failed: ${error.message}`);
  }

  return summarizeIntegrations(provider.id, provider.name, mergeWithRequiredSources(provider.id, (data ?? []).map(mapIntegration)));
}

export async function upsertExternalReviewIntegration(
  input: UpsertExternalReviewIntegrationInput
): Promise<ExternalReviewIntegrationRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  if (!sourceCatalog[input.source]) {
    throw new Error("Unsupported external review source");
  }

  const policy = await runPolicyCheck({
    subjectType: "external_review_integration",
    subjectId: provider.id,
    actionKey: "upsert_external_review_integration",
    input
  });

  if (policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "External review integration blocked by policy");
  }

  const readiness = integrationStatus(input);
  const syncMode = input.syncMode ?? sourceCatalog[input.source].syncMode;
  const record: ExternalReviewIntegrationRecord = {
    id: `external-review-integration-${provider.id}-${input.source}`,
    providerId: provider.id,
    source: input.source,
    sourceLabel: sourceLabel(input.source),
    status: readiness.status,
    syncMode,
    credentialReference: input.credentialReference,
    reviewCount: 0,
    blockers: readiness.blockers,
    payload: {
      ...(input.payload ?? {}),
      credentialOwner: "provider",
      policyDecision: policy.decision,
      liveSyncAllowed: readiness.status === "credential_ready"
    },
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const existingIndex = seedExternalReviewIntegrations.findIndex(
      (integration) => integration.providerId === provider.id && integration.source === input.source
    );

    if (existingIndex >= 0) {
      seedExternalReviewIntegrations[existingIndex] = { ...seedExternalReviewIntegrations[existingIndex], ...record };
    } else {
      seedExternalReviewIntegrations.unshift(record);
    }

    await recordAuditEvent({
      actorId: input.actorId,
      actorType: input.actorId ? "provider" : "system",
      eventType: "external_review_integration.upserted",
      subjectType: "provider",
      subjectId: provider.id,
      payload: {
        source: input.source,
        status: record.status,
        syncMode,
        blockers: record.blockers
      }
    });

    return record;
  }

  const { data, error } = await supabase
    .from("external_review_integrations")
    .upsert({
      provider_id: provider.id,
      source: input.source,
      status: record.status,
      sync_mode: syncMode,
      credential_reference: input.credentialReference,
      blockers: record.blockers,
      payload: record.payload
    }, { onConflict: "provider_id,source" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`External review integration upsert failed: ${error.message}`);
  }

  await recordAuditEvent({
    actorId: input.actorId,
    actorType: input.actorId ? "provider" : "system",
    eventType: "external_review_integration.upserted",
    subjectType: "provider",
    subjectId: provider.id,
    payload: {
      source: input.source,
      status: record.status,
      syncMode,
      blockers: record.blockers
    }
  });

  return mapIntegration(data);
}
