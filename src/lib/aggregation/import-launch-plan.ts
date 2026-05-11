import type { ImportLaunchPlanBatch, ImportLaunchPlanSummary } from "@/lib/domain/imports";
import { listDataSources } from "@/lib/data-sources";
import { createImportBatch, listImportBatches } from "@/lib/import-batches";

type LaunchPlanInput = {
  targetListings?: number;
  batchSize?: number;
  createQueuedBatches?: boolean;
};

function clampPositiveInteger(value: number | undefined, fallback: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(Math.floor(parsed), max);
}

export async function getImportLaunchPlan(input: LaunchPlanInput = {}): Promise<ImportLaunchPlanSummary> {
  const targetListings = clampPositiveInteger(input.targetListings, 5000, 50000);
  const batchSize = clampPositiveInteger(input.batchSize, 500, 2500);
  const [sources, batches] = await Promise.all([listDataSources(), listImportBatches()]);
  const approvedSources = sources.filter((source) => source.reviewStatus === "approved");
  const importedListings = batches.reduce((total, batch) => total + batch.importedRecords, 0);
  const stagedRecords = batches.reduce((total, batch) => total + batch.totalRecords, 0);
  const remainingListings = Math.max(targetListings - Math.max(importedListings, stagedRecords), 0);
  const blockers: string[] = [];
  const plannedBatches: ImportLaunchPlanBatch[] = [];

  if (!approvedSources.length) {
    blockers.push("Approve at least one legally reviewed data source before creating launch import batches.");
  }

  if (remainingListings > 0 && approvedSources.length) {
    const requiredBatches = Math.ceil(remainingListings / batchSize);

    for (let index = 0; index < requiredBatches; index += 1) {
      const source = approvedSources[index % approvedSources.length];
      const estimatedRecords = Math.min(batchSize, remainingListings - index * batchSize);

      plannedBatches.push({
        name: `Launch inventory wave ${index + 1}: ${source.name}`,
        dataSourceId: source.id,
        sourceName: source.name,
        sourceKind: source.sourceType,
        estimatedRecords,
        wave: index + 1
      });
    }
  }

  const createdBatches = input.createQueuedBatches && plannedBatches.length
    ? await Promise.all(
        plannedBatches.map((batch) =>
          createImportBatch({
            dataSourceId: batch.dataSourceId,
            name: batch.name,
            sourceKind: batch.sourceKind,
            estimatedRecords: batch.estimatedRecords
          })
        )
      )
    : undefined;

  return {
    generatedAt: new Date().toISOString(),
    targetListings,
    batchSize,
    importedListings,
    stagedRecords,
    remainingListings,
    approvedSources: approvedSources.length,
    existingBatches: batches.length,
    plannedBatches,
    createdBatches,
    blockers,
    nextActions: blockers.length
      ? blockers
      : plannedBatches.length
        ? [
            input.createQueuedBatches
              ? "Run the queued launch import batches with source-specific records."
              : "Review the planned waves, then call this endpoint with createQueuedBatches=true to queue them."
          ]
        : ["Launch import target is already covered by staged or imported records."]
  };
}
