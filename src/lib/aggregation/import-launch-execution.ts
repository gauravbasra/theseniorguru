import { runImportBatch } from "@/lib/aggregation/import-worker";
import { seedLaunchImportSources } from "@/lib/aggregation/launch-source-seeding";
import { previewCurrentSiteRealListings } from "@/lib/aggregation/public-source-acquisition";
import type {
  ImportBatchRecord,
  ImportRecordInput,
  LaunchImportExecutionBatchSummary,
  LaunchImportExecutionSummary
} from "@/lib/domain/imports";
import { listImportBatches } from "@/lib/import-batches";

type LaunchImportExecutionInput = {
  actorId?: string;
  dryRun?: boolean;
  ensureSources?: boolean;
  maxRecords?: number;
  starterBatchSize?: number;
};

function clampPositiveInteger(value: number | undefined, fallback: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

function isLaunchBatch(batch: ImportBatchRecord) {
  return batch.name.startsWith("Launch source starter:") || batch.name.startsWith("Launch inventory wave ");
}

function isCurrentSiteBatch(batch: ImportBatchRecord) {
  return batch.name.includes("TheSeniorGuru.com current public listing index");
}

function adapterBlockerFor(batch: ImportBatchRecord) {
  if (batch.sourceKind === "cms") {
    return "CMS adapter execution is blocked until the approved production dataset/API export is connected.";
  }

  if (batch.sourceKind === "state_license") {
    return "State licensing adapter execution is blocked until the owner-approved state directory export or API contract is connected.";
  }

  return "No source-specific execution adapter is registered for this launch batch yet.";
}

function summarizeStatusBatch(batch: ImportBatchRecord): LaunchImportExecutionBatchSummary {
  if (!isLaunchBatch(batch)) {
    return {
      batchId: batch.id,
      name: batch.name,
      sourceKind: batch.sourceKind,
      status: batch.status,
      estimatedRecords: batch.totalRecords,
      action: "skipped",
      reason: "Not a launch import batch."
    };
  }

  if (batch.status !== "queued") {
    return {
      batchId: batch.id,
      name: batch.name,
      sourceKind: batch.sourceKind,
      status: batch.status,
      estimatedRecords: batch.totalRecords,
      action: "skipped",
      reason: `Batch is ${batch.status}; only queued batches are runnable.`
    };
  }

  if (isCurrentSiteBatch(batch)) {
    return {
      batchId: batch.id,
      name: batch.name,
      sourceKind: batch.sourceKind,
      status: batch.status,
      estimatedRecords: batch.totalRecords,
      action: "ready"
    };
  }

  return {
    batchId: batch.id,
    name: batch.name,
    sourceKind: batch.sourceKind,
    status: batch.status,
    estimatedRecords: batch.totalRecords,
    action: "blocked",
    reason: adapterBlockerFor(batch)
  };
}

function buildSummary(input: {
  mode: "status" | "execute";
  dryRun: boolean;
  batches: LaunchImportExecutionBatchSummary[];
  previewError?: string;
}): LaunchImportExecutionSummary {
  const totals = input.batches.reduce(
    (current, batch) => ({
      totalRecords: current.totalRecords + (batch.run?.totalRecords ?? 0),
      stagedRecords: current.stagedRecords + (batch.run?.stagedRecords ?? 0),
      skippedRecords: current.skippedRecords + (batch.run?.skippedRecords ?? 0),
      rejectedRecords: current.rejectedRecords + (batch.run?.rejectedRecords ?? 0),
      errorRecords: current.errorRecords + (batch.run?.errorRecords ?? 0)
    }),
    { totalRecords: 0, stagedRecords: 0, skippedRecords: 0, rejectedRecords: 0, errorRecords: 0 }
  );
  const blockers = [
    ...input.batches
      .filter((batch) => batch.action === "blocked")
      .map((batch) => `${batch.name}: ${batch.reason}`),
    ...(input.previewError ? [`Current-site preview failed: ${input.previewError}`] : [])
  ];
  const readyCount = input.batches.filter((batch) => batch.action === "ready").length;
  const executedCount = input.batches.filter((batch) => batch.action === "executed").length;

  return {
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    dryRun: input.dryRun,
    batchesReviewed: input.batches.length,
    runnableBatches: readyCount + executedCount,
    executedBatches: executedCount,
    skippedBatches: input.batches.filter((batch) => batch.action === "skipped").length,
    blockedBatches: input.batches.filter((batch) => batch.action === "blocked").length,
    totals,
    batches: input.batches,
    blockers,
    nextActions: [
      ...(readyCount && input.mode === "status"
        ? ["Call this endpoint with POST to run the current-site launch starter batch through the import worker."]
        : []),
      ...(executedCount && input.dryRun
        ? ["Review dry-run output, then rerun with dryRun=false after Supabase persistence and owner source limits are confirmed."]
        : []),
      ...(executedCount && !input.dryRun
        ? ["Review staged extracted entities for duplicate scoring, image rights review, and publication approval."]
        : []),
      ...(blockers.length
        ? ["Keep CMS/state batches queued until owner-approved source adapters or export files are connected."]
        : []),
      ...(!input.batches.length ? ["Seed launch import sources before executing launch import batches."] : [])
    ]
  };
}

export async function getLaunchImportExecutionStatus(): Promise<LaunchImportExecutionSummary> {
  const batches = (await listImportBatches()).filter(isLaunchBatch).map(summarizeStatusBatch);

  return buildSummary({
    mode: "status",
    dryRun: true,
    batches
  });
}

export async function runLaunchImportExecution(
  input: LaunchImportExecutionInput = {}
): Promise<LaunchImportExecutionSummary> {
  const dryRun = input.dryRun ?? true;
  const maxRecords = clampPositiveInteger(input.maxRecords, 25, 250);
  const starterBatchSize = clampPositiveInteger(input.starterBatchSize, Math.max(maxRecords, 25), 2500);

  if (input.ensureSources !== false) {
    await seedLaunchImportSources({
      actorId: input.actorId,
      createStarterBatches: true,
      starterBatchSize
    });
  }

  const launchBatches = (await listImportBatches()).filter(isLaunchBatch);
  const batchSummaries = launchBatches.map(summarizeStatusBatch);
  const currentSiteBatch = launchBatches.find((batch) => batch.status === "queued" && isCurrentSiteBatch(batch));
  let previewRecords: ImportRecordInput[] = [];
  let previewError: string | undefined;

  if (currentSiteBatch) {
    try {
      const preview = await previewCurrentSiteRealListings({ maxRecords, order: "desc" });
      const recordLimit = Math.max(1, Math.min(maxRecords, currentSiteBatch.totalRecords || maxRecords));
      previewRecords = preview.records.slice(0, recordLimit);

      if (!previewRecords.length) {
        previewError = "No current-site records were parsed for execution.";
      }
    } catch (error) {
      previewError = error instanceof Error ? error.message : "Unknown current-site preview error";
    }
  }

  const executedBatches = await Promise.all(
    batchSummaries.map(async (summary) => {
      if (!currentSiteBatch || summary.batchId !== currentSiteBatch.id || !previewRecords.length) {
        return summary;
      }

      const run = await runImportBatch(currentSiteBatch.id, {
        actorId: input.actorId,
        dryRun,
        records: previewRecords
      });

      return {
        ...summary,
        action: "executed" as const,
        run
      };
    })
  );

  return buildSummary({
    mode: "execute",
    dryRun,
    batches: executedBatches,
    previewError
  });
}
