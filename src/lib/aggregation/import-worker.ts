import { createExtractedEntity } from "@/lib/aggregation/extracted-entities";
import { seedDataSources } from "@/lib/data/seed";
import type { ImportBatchRunResult, ImportRecordInput, RunImportBatchInput } from "@/lib/domain/imports";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type ImportBatchRow = {
  id: string;
  data_source_id?: string | null;
  source_kind: string;
  name: string;
};

function normalizeCategories(value: unknown) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 10) : [];
}

function normalizeRecord(record: ImportRecordInput) {
  return {
    name: record.name?.trim(),
    addressLine1: record.addressLine1?.trim(),
    city: record.city?.trim(),
    state: record.state?.trim().toUpperCase(),
    postalCode: record.postalCode?.trim(),
    phone: record.phone?.trim(),
    websiteUrl: record.websiteUrl?.trim(),
    categories: normalizeCategories(record.categories),
    confidenceScore: Math.max(0, Math.min(1, Number(record.confidenceScore ?? 0.5))),
    rawPayload: record.rawPayload ?? record,
    extractedFields: {
      ...(record.extractedFields ?? {}),
      sourceUrl: record.sourceUrl,
      sourceRecordId: record.sourceRecordId
    }
  };
}

function validateRecord(record: ReturnType<typeof normalizeRecord>) {
  if (!record.name) {
    return "name is required";
  }

  if (!record.city || !record.state) {
    return "city and state are required for launch-quality inventory";
  }

  if (record.websiteUrl && !record.websiteUrl.startsWith("http")) {
    return "websiteUrl must be an absolute URL";
  }

  return null;
}

async function getImportBatch(batchId: string): Promise<ImportBatchRow | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: batchId,
      data_source_id: seedDataSources[0]?.id,
      source_kind: "cms",
      name: "Fallback import batch"
    };
  }

  const { data, error } = await supabase
    .from("import_batches")
    .select("id,data_source_id,source_kind,name")
    .eq("id", batchId)
    .single();

  if (error) {
    throw new Error(`Import batch lookup failed: ${error.message}`);
  }

  return data;
}

async function ensureSourceApproved(batch: ImportBatchRow) {
  if (batch.source_kind === "manual") {
    return;
  }

  if (!batch.data_source_id) {
    throw new Error("Non-manual imports require an approved registered data source.");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const source = seedDataSources.find((item) => item.id === batch.data_source_id);

    if (!source || source.reviewStatus !== "approved") {
      throw new Error("Data source is not approved for import.");
    }

    return;
  }

  const { data, error } = await supabase
    .from("data_sources")
    .select("id,review_status,robots_status")
    .eq("id", batch.data_source_id)
    .single();

  if (error) {
    throw new Error(`Data source lookup failed: ${error.message}`);
  }

  if (data.review_status !== "approved") {
    throw new Error("Data source is not approved for import.");
  }

  if (data.robots_status === "blocked") {
    throw new Error("Data source robots policy blocks import.");
  }
}

export async function runImportBatch(batchId: string, input: RunImportBatchInput): Promise<ImportBatchRunResult> {
  const batch = await getImportBatch(batchId);

  if (!batch) {
    throw new Error("Import batch not found");
  }

  await ensureSourceApproved(batch);

  const policy = await runPolicyCheck({
    subjectType: "import_batch",
    subjectId: batchId,
    actionKey: "run_import_batch",
    input: {
      batchId,
      sourceKind: batch.source_kind,
      recordCount: input.records.length,
      dryRun: input.dryRun ?? false
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Import batch blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const dryRun = input.dryRun ?? false;
  const startedAt = new Date().toISOString();

  if (supabase && !dryRun) {
    await supabase
      .from("import_batches")
      .update({ status: "running", total_records: input.records.length, started_at: startedAt })
      .eq("id", batchId);
  }

  let stagedRecords = 0;
  let rejectedRecords = 0;
  let errorRecords = 0;
  const errors: ImportBatchRunResult["errors"] = [];

  for (const [index, record] of input.records.entries()) {
    const normalized = normalizeRecord(record);
    const validationError = validateRecord(normalized);

    if (validationError) {
      rejectedRecords += 1;
      errors.push({ index, reason: validationError });
      continue;
    }

    if (dryRun) {
      stagedRecords += 1;
      continue;
    }

    try {
      const name = normalized.name;

      if (!name) {
        throw new Error("name is required");
      }

      await createExtractedEntity({
        importBatchId: batchId,
        entityType: "provider",
        name,
        addressLine1: normalized.addressLine1,
        city: normalized.city,
        state: normalized.state,
        postalCode: normalized.postalCode,
        phone: normalized.phone,
        websiteUrl: normalized.websiteUrl,
        categories: normalized.categories,
        rawPayload: normalized.rawPayload,
        extractedFields: normalized.extractedFields,
        confidenceScore: normalized.confidenceScore
      });
      stagedRecords += 1;
    } catch (error) {
      errorRecords += 1;
      errors.push({ index, reason: error instanceof Error ? error.message : "Unknown import error" });
    }
  }

  const status = errorRecords > 0 || rejectedRecords > 0 ? "completed_with_errors" : "completed";
  const completedAt = new Date().toISOString();

  if (supabase && !dryRun) {
    const { error } = await supabase
      .from("import_batches")
      .update({
        status,
        total_records: input.records.length,
        imported_records: stagedRecords,
        rejected_records: rejectedRecords,
        error_records: errorRecords,
        completed_at: completedAt
      })
      .eq("id", batchId);

    if (error) {
      throw new Error(`Import batch completion update failed: ${error.message}`);
    }

    await supabase.from("audit_events").insert({
      actor_id: input.actorId,
      actor_type: input.actorId ? "admin" : "system",
      event_type: "import_batch.run",
      subject_type: "import_batch",
      subject_id: batchId,
      payload: {
        sourceKind: batch.source_kind,
        totalRecords: input.records.length,
        stagedRecords,
        rejectedRecords,
        errorRecords,
        policyDecision: policy.decision
      }
    });
  }

  return {
    batchId,
    status,
    totalRecords: input.records.length,
    stagedRecords,
    rejectedRecords,
    errorRecords,
    dryRun,
    errors
  };
}
