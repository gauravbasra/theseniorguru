import { seedDataSources } from "@/lib/data/seed";
import type { DataSourceRecord, DataSourceReviewStatus } from "@/lib/domain/providers";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type DataSourceDecisionInput = {
  actorId?: string;
  reviewStatus: Extract<DataSourceReviewStatus, "approved" | "blocked" | "needs_legal_review">;
  robotsStatus?: string;
  termsNotes?: string;
  decisionNotes?: string;
};

function mapDataSource(source: {
  id: string;
  name: string;
  source_type: DataSourceRecord["sourceType"];
  base_url?: string | null;
  jurisdiction?: string | null;
  review_status: DataSourceRecord["reviewStatus"];
  robots_status?: string | null;
  terms_notes?: string | null;
  approved_at?: string | null;
}): DataSourceRecord {
  return {
    id: source.id,
    name: source.name,
    sourceType: source.source_type,
    baseUrl: source.base_url ?? undefined,
    jurisdiction: source.jurisdiction ?? undefined,
    reviewStatus: source.review_status,
    robotsStatus: source.robots_status ?? undefined,
    termsNotes: source.terms_notes ?? undefined,
    approvedAt: source.approved_at ?? undefined
  };
}

function isUuid(value?: string) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

export async function listDataSources(): Promise<DataSourceRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedDataSources;
  }

  const { data, error } = await supabase
    .from("data_sources")
    .select("id,name,source_type,base_url,jurisdiction,review_status,robots_status,terms_notes,approved_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Data source query failed: ${error.message}`);
  }

  return (data ?? []).map(mapDataSource);
}

export async function getApprovedDataSourceByBaseUrl(baseUrl: string): Promise<DataSourceRecord> {
  const normalized = baseUrl.trim();
  const source = (await listDataSources()).find((item) => item.baseUrl === normalized);

  if (!source) {
    throw new Error(`Approved data source is not registered for ${normalized}`);
  }

  if (source.reviewStatus !== "approved") {
    throw new Error(`Data source ${source.name} is not approved for live acquisition`);
  }

  if (source.robotsStatus === "blocked" || source.robotsStatus === "disallowed") {
    throw new Error(`Data source ${source.name} is blocked by robots policy`);
  }

  return source;
}

export async function createDataSource(input: Omit<DataSourceRecord, "id">) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const record: DataSourceRecord = {
      id: `pending-${Date.now()}`,
      ...input
    };

    seedDataSources.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("data_sources")
    .insert({
      name: input.name,
      source_type: input.sourceType,
      base_url: input.baseUrl,
      jurisdiction: input.jurisdiction,
      review_status: input.reviewStatus,
      robots_status: input.robotsStatus,
      terms_notes: input.termsNotes,
      approved_at: input.approvedAt
    })
    .select("id,name,source_type,base_url,jurisdiction,review_status,robots_status,terms_notes,approved_at")
    .single();

  if (error) {
    throw new Error(`Data source creation failed: ${error.message}`);
  }

  return mapDataSource(data);
}

export async function decideDataSourceReview(dataSourceId: string, input: DataSourceDecisionInput): Promise<DataSourceRecord> {
  const existing = (await listDataSources()).find((source) => source.id === dataSourceId);

  if (!existing) {
    throw new Error("Data source not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "data_source",
    subjectId: dataSourceId,
    actionKey: `data_source.${input.reviewStatus}`,
    input: {
      ...existing,
      ...input
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Data source decision blocked by policy");
  }

  const approvedAt = input.reviewStatus === "approved" ? new Date().toISOString() : undefined;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    existing.reviewStatus = input.reviewStatus;
    existing.robotsStatus = input.robotsStatus ?? existing.robotsStatus;
    existing.termsNotes = input.termsNotes ?? input.decisionNotes ?? existing.termsNotes;
    existing.approvedAt = approvedAt;
    return existing;
  }

  const { data, error } = await supabase
    .from("data_sources")
    .update({
      review_status: input.reviewStatus,
      robots_status: input.robotsStatus ?? existing.robotsStatus,
      terms_notes: input.termsNotes ?? input.decisionNotes ?? existing.termsNotes,
      approved_at: approvedAt ?? null
    })
    .eq("id", dataSourceId)
    .select("id,name,source_type,base_url,jurisdiction,review_status,robots_status,terms_notes,approved_at")
    .single();

  if (error) {
    throw new Error(`Data source review update failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: isUuid(input.actorId) ? input.actorId : undefined,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "data_source.review_decision",
    subject_type: "data_source",
    subject_id: dataSourceId,
    payload: {
      reviewStatus: input.reviewStatus,
      robotsStatus: input.robotsStatus ?? existing.robotsStatus,
      decisionNotes: input.decisionNotes,
      policyDecision: policy.decision,
      actorId: input.actorId
    }
  });

  return mapDataSource(data);
}
