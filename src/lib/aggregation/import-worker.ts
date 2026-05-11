import { createExtractedEntity } from "@/lib/aggregation/extracted-entities";
import { seedDataSources } from "@/lib/data/seed";
import type { ImportBatchRunResult, ImportRecordInput, RunImportBatchInput } from "@/lib/domain/imports";
import { completeImportBatch, failImportBatch, markImportBatchRunning } from "@/lib/import-batches";
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

function normalizeTextArray(value: unknown, limit = 25) {
  return Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, limit) : [];
}

function normalizeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function normalizeRecord(record: ImportRecordInput) {
  return {
    name: record.name?.trim(),
    addressLine1: record.addressLine1?.trim(),
    addressLine2: record.addressLine2?.trim(),
    city: record.city?.trim(),
    state: record.state?.trim().toUpperCase(),
    postalCode: record.postalCode?.trim(),
    county: record.county?.trim(),
    latitude: normalizeNumber(record.latitude),
    longitude: normalizeNumber(record.longitude),
    phone: record.phone?.trim(),
    email: record.email?.trim(),
    websiteUrl: record.websiteUrl?.trim(),
    categories: normalizeCategories(record.categories),
    careTypes: normalizeTextArray(record.careTypes),
    amenities: normalizeTextArray(record.amenities),
    services: normalizeTextArray(record.services),
    description: record.description?.trim(),
    pricingSignals: record.pricingSignals ?? {},
    licenseFields: record.licenseFields ?? {},
    accreditationFields: record.accreditationFields ?? {},
    sourceUrl: record.sourceUrl?.trim(),
    sourceRecordId: record.sourceRecordId?.trim(),
    fetchedAt: record.fetchedAt,
    licenseTermsStatus: record.licenseTermsStatus ?? "unknown",
    robotsDecision: record.robotsDecision ?? "unknown",
    extractionConfidence: Math.max(0, Math.min(1, Number(record.extractionConfidence ?? record.confidenceScore ?? 0.5))),
    duplicateMatchData: record.duplicateMatchData ?? {},
    imageAssets: Array.isArray(record.imageAssets) ? record.imageAssets.slice(0, 12) : [],
    auditTrail: Array.isArray(record.auditTrail) ? record.auditTrail.slice(0, 25) : [],
    confidenceScore: Math.max(0, Math.min(1, Number(record.confidenceScore ?? 0.5))),
    rawPayload: record.rawPayload ?? record,
    extractedFields: {
      ...(record.extractedFields ?? {}),
      sourceUrl: record.sourceUrl,
      sourceRecordId: record.sourceRecordId,
      fetchedAt: record.fetchedAt,
      licenseTermsStatus: record.licenseTermsStatus,
      robotsDecision: record.robotsDecision,
      imageCount: Array.isArray(record.imageAssets) ? record.imageAssets.length : 0
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

  try {
    await ensureSourceApproved(batch);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import source approval check failed";
    await failImportBatch({ batchId, actorId: input.actorId, reason: message });
    throw error;
  }

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
    await failImportBatch({
      batchId,
      actorId: input.actorId,
      status: "blocked_by_policy",
      reason: policy.reasons[0] ?? "Import batch blocked by policy"
    });
    throw new Error(policy.reasons[0] ?? "Import batch blocked by policy");
  }

  const dryRun = input.dryRun ?? false;
  const startedAt = new Date().toISOString();

  if (!dryRun) {
    await markImportBatchRunning({ batchId, totalRecords: input.records.length, startedAt });
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
        addressLine2: normalized.addressLine2,
        city: normalized.city,
        state: normalized.state,
        postalCode: normalized.postalCode,
        county: normalized.county,
        latitude: normalized.latitude,
        longitude: normalized.longitude,
        phone: normalized.phone,
        email: normalized.email,
        websiteUrl: normalized.websiteUrl,
        categories: normalized.categories,
        careTypes: normalized.careTypes,
        amenities: normalized.amenities,
        services: normalized.services,
        description: normalized.description,
        pricingSignals: normalized.pricingSignals,
        licenseFields: normalized.licenseFields,
        accreditationFields: normalized.accreditationFields,
        sourceUrl: normalized.sourceUrl,
        sourceRecordId: normalized.sourceRecordId,
        fetchedAt: normalized.fetchedAt,
        licenseTermsStatus: normalized.licenseTermsStatus,
        robotsDecision: normalized.robotsDecision,
        extractionConfidence: normalized.extractionConfidence,
        duplicateMatchData: normalized.duplicateMatchData,
        imageAssets: normalized.imageAssets,
        auditTrail: normalized.auditTrail,
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

  if (!dryRun) {
    await completeImportBatch({
      batchId,
      status,
      totalRecords: input.records.length,
      importedRecords: stagedRecords,
      rejectedRecords,
      errorRecords,
      completedAt,
      actorId: input.actorId,
      sourceKind: batch.source_kind,
      policyDecision: policy.decision
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
