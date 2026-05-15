import { listExtractedEntities } from "@/lib/aggregation/extracted-entities";
import type { ExtractedEntityRecord } from "@/lib/domain/entities";
import { getImportBatchRecord } from "@/lib/import-batches";

export type ImportBatchEvidenceFormat = "json" | "csv";

type ImportBatchEvidenceRow = {
  section: "batch" | "staged_entity" | "quality_gap" | "blocker" | "next_action";
  key: string;
  status: string;
  name?: string;
  sourceRecordId?: string;
  sourceUrl?: string;
  city?: string;
  state?: string;
  confidenceScore?: number;
  detail?: string;
};

export type ImportBatchEvidenceExport = {
  generatedAt: string;
  batchId: string;
  status: "ready_for_review" | "needs_requeue" | "needs_import_run" | "blocked";
  totals: {
    totalRecords: number;
    importedRecords: number;
    skippedRecords: number;
    rejectedRecords: number;
    errorRecords: number;
    stagedEntities: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    duplicates: number;
    needsReview: number;
    imageBacklog: number;
    missingSourceRecordId: number;
    lowConfidence: number;
  };
  rows: ImportBatchEvidenceRow[];
  blockers: string[];
  nextActions: string[];
  csv?: string;
};

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function rowsToCsv(rows: ImportBatchEvidenceRow[]) {
  const headers = [
    "section",
    "key",
    "status",
    "name",
    "sourceRecordId",
    "sourceUrl",
    "city",
    "state",
    "confidenceScore",
    "detail"
  ];

  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.section,
        row.key,
        row.status,
        row.name ?? "",
        row.sourceRecordId ?? "",
        row.sourceUrl ?? "",
        row.city ?? "",
        row.state ?? "",
        row.confidenceScore ?? "",
        row.detail ?? ""
      ]
        .map(csvEscape)
        .join(",")
    )
  ].join("\n");
}

function entityQualityGaps(entity: ExtractedEntityRecord) {
  return [
    !entity.sourceRecordId ? "Missing source record id" : undefined,
    !entity.sourceUrl ? "Missing source URL" : undefined,
    !entity.fetchedAt ? "Missing fetchedAt timestamp" : undefined,
    !entity.city || !entity.state ? "Missing city/state" : undefined,
    !entity.phone && !entity.websiteUrl ? "Missing contact path" : undefined,
    (entity.imageAssets?.length ?? 0) < 3 ? "Image backlog" : undefined,
    entity.confidenceScore < 0.7 ? "Low confidence score" : undefined,
    entity.licenseTermsStatus && ["blocked", "prohibited", "disallowed"].includes(entity.licenseTermsStatus.toLowerCase())
      ? "License terms block review"
      : undefined,
    entity.robotsDecision && ["blocked", "disallowed"].includes(entity.robotsDecision.toLowerCase())
      ? "Robots policy blocks review"
      : undefined
  ].filter((item): item is string => Boolean(item));
}

function decideStatus(batchStatus: string, blockers: string[], stagedEntities: number): ImportBatchEvidenceExport["status"] {
  if (batchStatus === "blocked_by_policy" || blockers.some((blocker) => blocker.includes("blocked"))) {
    return "blocked";
  }

  if (batchStatus === "failed" || batchStatus === "completed_with_errors") {
    return "needs_requeue";
  }

  if (stagedEntities === 0 || batchStatus === "queued" || batchStatus === "draft") {
    return "needs_import_run";
  }

  return "ready_for_review";
}

export async function exportImportBatchEvidence(
  batchId: string,
  format: ImportBatchEvidenceFormat = "json"
): Promise<ImportBatchEvidenceExport> {
  const batch = await getImportBatchRecord(batchId);

  if (!batch) {
    throw new Error("Import batch not found");
  }

  const entities = (await listExtractedEntities("all")).filter((entity) => entity.importBatchId === batchId);
  const qualityGapRows = entities.flatMap((entity) =>
    entityQualityGaps(entity).map((gap) => ({
      section: "quality_gap" as const,
      key: entity.id,
      status: "open",
      name: entity.name,
      sourceRecordId: entity.sourceRecordId,
      sourceUrl: entity.sourceUrl,
      city: entity.city,
      state: entity.state,
      confidenceScore: entity.confidenceScore,
      detail: gap
    }))
  );
  const blockers = [
    ...(batch.status === "failed" ? ["Import batch failed and must be requeued before launch inventory can count it."] : []),
    ...(batch.status === "blocked_by_policy" ? ["Import batch is blocked by policy and cannot be counted for launch inventory."] : []),
    ...(batch.status === "completed_with_errors" ? ["Import batch completed with rejected or errored records; review evidence before requeueing."] : []),
    ...(entities.length === 0 ? ["No staged entities are attached to this import batch."] : [])
  ];
  const nextActions = [
    ...(batch.status === "queued" || batch.status === "draft"
      ? ["Run the import batch in dry-run first, then live with dryRun=false after reviewing source coverage."]
      : []),
    ...(batch.status === "failed" || batch.status === "blocked_by_policy" || batch.status === "completed_with_errors"
      ? ["Use the import batch requeue API after resolving source, policy, or validation blockers."]
      : []),
    ...(entities.some((entity) => entity.reviewStatus === "pending" || entity.reviewStatus === "needs_human_review")
      ? ["Review staged entities before publishing them into provider inventory."]
      : []),
    ...(qualityGapRows.length ? ["Resolve quality gaps before counting the batch toward the 5,000-listing launch target."] : [])
  ];
  const rows: ImportBatchEvidenceRow[] = [
    {
      section: "batch",
      key: batch.id,
      status: batch.status,
      name: batch.name,
      detail: `sourceKind=${batch.sourceKind}; total=${batch.totalRecords}; imported=${batch.importedRecords}; skipped=${batch.skippedRecords ?? 0}; rejected=${batch.rejectedRecords}; errors=${batch.errorRecords}`
    },
    ...entities.map((entity) => ({
      section: "staged_entity" as const,
      key: entity.id,
      status: entity.reviewStatus,
      name: entity.name,
      sourceRecordId: entity.sourceRecordId,
      sourceUrl: entity.sourceUrl,
      city: entity.city,
      state: entity.state,
      confidenceScore: entity.confidenceScore,
      detail: `categories=${entity.categories.join("|")}; imageCount=${entity.imageAssets?.length ?? 0}`
    })),
    ...qualityGapRows,
    ...blockers.map((blocker) => ({
      section: "blocker" as const,
      key: "import_batch_blocker",
      status: "blocked",
      detail: blocker
    })),
    ...nextActions.map((action) => ({
      section: "next_action" as const,
      key: "import_batch_next_action",
      status: "open",
      detail: action
    }))
  ];
  const result: ImportBatchEvidenceExport = {
    generatedAt: new Date().toISOString(),
    batchId,
    status: decideStatus(batch.status, blockers, entities.length),
    totals: {
      totalRecords: batch.totalRecords,
      importedRecords: batch.importedRecords,
      skippedRecords: batch.skippedRecords ?? 0,
      rejectedRecords: batch.rejectedRecords,
      errorRecords: batch.errorRecords,
      stagedEntities: entities.length,
      pendingReview: entities.filter((entity) => entity.reviewStatus === "pending").length,
      approved: entities.filter((entity) => entity.reviewStatus === "approved").length,
      rejected: entities.filter((entity) => entity.reviewStatus === "rejected").length,
      duplicates: entities.filter((entity) => entity.reviewStatus === "duplicate").length,
      needsReview: entities.filter((entity) => entity.reviewStatus === "needs_human_review" || entity.reviewStatus === "needs_legal_review").length,
      imageBacklog: entities.filter((entity) => (entity.imageAssets?.length ?? 0) < 3).length,
      missingSourceRecordId: entities.filter((entity) => !entity.sourceRecordId).length,
      lowConfidence: entities.filter((entity) => entity.confidenceScore < 0.7).length
    },
    rows,
    blockers,
    nextActions
  };

  return format === "csv" ? { ...result, csv: rowsToCsv(rows) } : result;
}
