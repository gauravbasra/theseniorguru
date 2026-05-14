import type {
  CreateImportBatchInput,
  ImportBatchRecord,
  ImportBatchStatus,
  RequeueImportBatchInput,
  RequeueImportBatchResult
} from "@/lib/domain/imports";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedImportBatches: ImportBatchRecord[] = [];
let fallbackImportBatchSequence = 0;

function findSeedImportBatch(batchId: string) {
  return seedImportBatches.find((batch) => batch.id === batchId);
}

function mapImportBatch(row: Record<string, unknown>): ImportBatchRecord {
  return {
    id: String(row.id),
    dataSourceId: row.data_source_id ? String(row.data_source_id) : undefined,
    status: row.status as ImportBatchRecord["status"],
    name: String(row.name),
    sourceKind: String(row.source_kind),
    totalRecords: Number(row.total_records ?? 0),
    importedRecords: Number(row.imported_records ?? 0),
    skippedRecords: Number(row.skipped_records ?? 0),
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

export async function getImportBatchRecord(batchId: string): Promise<ImportBatchRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return findSeedImportBatch(batchId) ?? null;
  }

  const { data, error } = await supabase.from("import_batches").select("*").eq("id", batchId).maybeSingle();

  if (error) {
    throw new Error(`Import batch lookup failed: ${error.message}`);
  }

  return data ? mapImportBatch(data) : null;
}

export async function markImportBatchRunning(input: {
  batchId: string;
  totalRecords: number;
  startedAt: string;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const batch = findSeedImportBatch(input.batchId);

    if (batch) {
      batch.status = "running";
      batch.totalRecords = input.totalRecords;
      batch.startedAt = input.startedAt;
      batch.completedAt = undefined;
    }

    return;
  }

  const { error } = await supabase
    .from("import_batches")
    .update({ status: "running", total_records: input.totalRecords, started_at: input.startedAt, completed_at: null })
    .eq("id", input.batchId);

  if (error) {
    throw new Error(`Import batch running update failed: ${error.message}`);
  }
}

export async function completeImportBatch(input: {
  batchId: string;
  status: Extract<ImportBatchStatus, "completed" | "completed_with_errors">;
  totalRecords: number;
  importedRecords: number;
  rejectedRecords: number;
  skippedRecords?: number;
  errorRecords: number;
  completedAt: string;
  actorId?: string;
  sourceKind: string;
  policyDecision: string;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const batch = findSeedImportBatch(input.batchId);

    if (batch) {
      batch.status = input.status;
      batch.totalRecords = input.totalRecords;
      batch.importedRecords = input.importedRecords;
      batch.rejectedRecords = input.rejectedRecords;
      batch.errorRecords = input.errorRecords;
      batch.completedAt = input.completedAt;
    }

    return;
  }

  const { error } = await supabase
    .from("import_batches")
    .update({
      status: input.status,
      total_records: input.totalRecords,
      imported_records: input.importedRecords,
      skipped_records: input.skippedRecords ?? 0,
      rejected_records: input.rejectedRecords,
      error_records: input.errorRecords,
      completed_at: input.completedAt
    })
    .eq("id", input.batchId);

  if (error) {
    throw new Error(`Import batch completion update failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "import_batch.run",
    subject_type: "import_batch",
    subject_id: input.batchId,
    payload: {
      sourceKind: input.sourceKind,
      totalRecords: input.totalRecords,
      stagedRecords: input.importedRecords,
      rejectedRecords: input.rejectedRecords,
      errorRecords: input.errorRecords,
      policyDecision: input.policyDecision
    }
  });
}

export async function failImportBatch(input: {
  batchId: string;
  status?: Extract<ImportBatchStatus, "failed" | "blocked_by_policy">;
  actorId?: string;
  reason: string;
}) {
  const status = input.status ?? "failed";
  const completedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const batch = findSeedImportBatch(input.batchId);

    if (batch) {
      batch.status = status;
      batch.errorRecords += 1;
      batch.completedAt = completedAt;
    }

    return;
  }

  const { error } = await supabase
    .from("import_batches")
    .update({ status, error_records: 1, completed_at: completedAt })
    .eq("id", input.batchId);

  if (error) {
    throw new Error(`Import batch failure update failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "import_batch.failed",
    subject_type: "import_batch",
    subject_id: input.batchId,
    payload: { reason: input.reason, status }
  });
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
    fallbackImportBatchSequence += 1;
    const batch: ImportBatchRecord = {
      id: `pending-import-${Date.now()}-${fallbackImportBatchSequence}`,
      dataSourceId: input.dataSourceId,
      status,
      name: input.name,
      sourceKind: input.sourceKind,
      totalRecords: input.estimatedRecords ?? 0,
      importedRecords: 0,
      skippedRecords: 0,
      rejectedRecords: 0,
      errorRecords: 0,
      createdAt: new Date().toISOString()
    };

    seedImportBatches.unshift(batch);
    return batch;
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

export async function requeueImportBatch(
  batchId: string,
  input: RequeueImportBatchInput = {}
): Promise<RequeueImportBatchResult> {
  const batch = await getImportBatchRecord(batchId);

  if (!batch) {
    throw new Error("Import batch not found");
  }

  const retryableStatuses: ImportBatchStatus[] = ["failed", "completed_with_errors", "blocked_by_policy", "running"];

  if (!retryableStatuses.includes(batch.status)) {
    throw new Error("Only failed, blocked, running, or completed-with-errors import batches can be requeued");
  }

  const policy = await runPolicyCheck({
    subjectType: "import_batch",
    subjectId: batchId,
    actionKey: "requeue_import_batch",
    input: {
      previousStatus: batch.status,
      reason: input.reason,
      actorId: input.actorId
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Import batch requeue blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const previousStatus = batch.status;

  if (!supabase) {
    batch.status = "queued";
    batch.importedRecords = 0;
    batch.rejectedRecords = 0;
    batch.errorRecords = 0;
    batch.startedAt = undefined;
    batch.completedAt = undefined;

    return { batch, previousStatus, status: "queued" };
  }

  const { data, error } = await supabase
    .from("import_batches")
    .update({
      status: "queued",
      imported_records: 0,
      rejected_records: 0,
      error_records: 0,
      started_at: null,
      completed_at: null
    })
    .eq("id", batchId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Import batch requeue failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "import_batch.requeued",
    subject_type: "import_batch",
    subject_id: batchId,
    payload: {
      previousStatus,
      reason: input.reason,
      policyDecision: policy.decision
    }
  });

  return { batch: mapImportBatch(data), previousStatus, status: "queued" };
}
