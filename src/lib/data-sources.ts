import { seedDataSources } from "@/lib/data/seed";
import type { DataSourceRecord } from "@/lib/domain/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

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

  return (data ?? []).map((source) => ({
    id: source.id,
    name: source.name,
    sourceType: source.source_type,
    baseUrl: source.base_url ?? undefined,
    jurisdiction: source.jurisdiction ?? undefined,
    reviewStatus: source.review_status,
    robotsStatus: source.robots_status ?? undefined,
    termsNotes: source.terms_notes ?? undefined,
    approvedAt: source.approved_at ?? undefined
  }));
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
    return {
      id: `pending-${Date.now()}`,
      ...input
    };
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

  return {
    id: data.id,
    name: data.name,
    sourceType: data.source_type,
    baseUrl: data.base_url ?? undefined,
    jurisdiction: data.jurisdiction ?? undefined,
    reviewStatus: data.review_status,
    robotsStatus: data.robots_status ?? undefined,
    termsNotes: data.terms_notes ?? undefined,
    approvedAt: data.approved_at ?? undefined
  };
}
