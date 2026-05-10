import type { CreateImportBatchInput, ImportBatchRecord } from "@/lib/domain/imports";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedImportBatches: ImportBatchRecord[] = [];

function mapImportBatch(row: Record<string, unknown>): ImportBatchRecord {
  return {
    id: String(row.id),
    dataSourceId: row.data_source_id ? String(row.data_source_id) : undefined,
    status: row.status as ImportBatchRecord["status"],
    name: String(row.name),
    sourceKind: String(row.source_kind),
    totalRecords: Number(row.total_records ?? 0),
    importedRecords: Number(row.imported_records ?? 0),
    rejectedRecords: Number(row.rejected_records ?? 0),
    errorRecords: Number(row.error_records ?? 0),
    policyCheckId: row.policy_check_id ? String(row.policy_check_id) : undefined,
    startedAt: row.started_at ? String(row.started_at) : undefined,
    completedAt: row.completed_at ? String(row.completed_at) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listImportBatches(): Promise<ImportBatchRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedImportBatches;
  }

  const { data, error } = await supabase.from("import_batches").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Import batch query failed: ${error.message}`);
  }

  return (data ?? []).map(mapImportBatch);
}

export async function createImportBatch(input: CreateImportBatchInput): Promise<ImportBatchRecord> {
  const policy = await runPolicyCheck({
    subjectType: "import_batch",
    actionKey: "create_import_batch",
    input: {
      name: input.name,
      sourceKind: input.sourceKind,
      dataSourceId: input.dataSourceId,
      estimatedRecords: input.estimatedRecords
    }
  });

  const status = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "queued";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-import-${Date.now()}`,
      dataSourceId: input.dataSourceId,
      status,
      name: input.name,
      sourceKind: input.sourceKind,
      totalRecords: input.estimatedRecords ?? 0,
      importedRecords: 0,
      rejectedRecords: 0,
      errorRecords: 0,
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("import_batches")
    .insert({
      data_source_id: input.dataSourceId,
      status,
      name: input.name,
      source_kind: input.sourceKind,
      total_records: input.estimatedRecords ?? 0
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Import batch creation failed: ${error.message}`);
  }

  return mapImportBatch(data);
}

