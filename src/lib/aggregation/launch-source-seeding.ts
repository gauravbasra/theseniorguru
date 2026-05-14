import {
  createDataSource,
  decideDataSourceReview,
  getDataSourceApprovalQueue,
  listDataSources
} from "@/lib/data-sources";
import type { DataSourceRecord } from "@/lib/domain/providers";
import type { LaunchImportSourceSeedSummary } from "@/lib/domain/imports";
import { createImportBatch, listImportBatches } from "@/lib/import-batches";

type SeedLaunchImportSourcesInput = {
  createStarterBatches?: boolean;
  starterBatchSize?: number;
  actorId?: string;
};

const launchSourceDefinitions: Array<Omit<DataSourceRecord, "id"> & { starterRecords: number }> = [
  {
    name: "CMS Care Compare",
    sourceType: "cms",
    baseUrl: "https://data.cms.gov/",
    jurisdiction: "US",
    reviewStatus: "approved",
    robotsStatus: "allowed",
    termsNotes: "Official federal provider data source approved for senior-care launch ingestion.",
    approvedAt: "2026-05-10T00:00:00.000Z",
    starterRecords: 500
  },
  {
    name: "TheSeniorGuru.com current public listing index",
    sourceType: "manual",
    baseUrl: "https://theseniorguru.com/search",
    jurisdiction: "US",
    reviewStatus: "approved",
    robotsStatus: "allowed",
    termsNotes: "Owner-controlled public listing index approved for launch inventory migration and enrichment.",
    approvedAt: "2026-05-11T00:00:00.000Z",
    starterRecords: 500
  },
  {
    name: "Colorado assisted living residence license directory",
    sourceType: "state_license",
    baseUrl: "https://cdphe.colorado.gov/assisted-living-residences",
    jurisdiction: "CO",
    reviewStatus: "approved",
    robotsStatus: "allowed",
    termsNotes:
      "Colorado state licensing directory approved for launch source coverage, subject to source-field validation before live import.",
    approvedAt: "2026-05-14T00:00:00.000Z",
    starterRecords: 250
  }
];

function normalizedUrl(value?: string) {
  return value?.replace(/\/$/, "").toLowerCase();
}

function sourceNeedsUpdate(source: DataSourceRecord, definition: Omit<DataSourceRecord, "id">) {
  return (
    source.reviewStatus !== "approved" ||
    source.robotsStatus !== definition.robotsStatus ||
    source.termsNotes !== definition.termsNotes ||
    source.jurisdiction !== definition.jurisdiction
  );
}

function starterBatchName(source: DataSourceRecord) {
  return `Launch source starter: ${source.name}`;
}

export async function seedLaunchImportSources(
  input: SeedLaunchImportSourcesInput = {}
): Promise<LaunchImportSourceSeedSummary> {
  const starterBatchSize = Math.max(1, Math.min(Number(input.starterBatchSize ?? 500), 2500));
  const existingSources = await listDataSources();
  const sourceActions: LaunchImportSourceSeedSummary["sources"] = [];
  const createdBatches: LaunchImportSourceSeedSummary["createdBatches"] = [];
  let sourcesCreated = 0;
  let sourcesUpdated = 0;

  for (const definition of launchSourceDefinitions) {
    const existing = existingSources.find(
      (source) =>
        normalizedUrl(source.baseUrl) === normalizedUrl(definition.baseUrl) ||
        source.name.toLowerCase() === definition.name.toLowerCase()
    );
    let source: DataSourceRecord;
    let action: LaunchImportSourceSeedSummary["sources"][number]["action"] = "already_ready";

    if (!existing) {
      source = await createDataSource(definition);
      sourcesCreated += 1;
      action = "created";
    } else if (sourceNeedsUpdate(existing, definition)) {
      source = await decideDataSourceReview(existing.id, {
        actorId: input.actorId,
        reviewStatus: "approved",
        robotsStatus: definition.robotsStatus,
        termsNotes: definition.termsNotes,
        decisionNotes: "Launch import source seeding completed required review metadata."
      });
      sourcesUpdated += 1;
      action = "updated";
    } else {
      source = existing;
    }

    sourceActions.push({
      id: source.id,
      name: source.name,
      sourceType: source.sourceType,
      reviewStatus: source.reviewStatus,
      robotsStatus: source.robotsStatus,
      action
    });
  }

  const refreshedSources = await listDataSources();
  const approvalQueue = await getDataSourceApprovalQueue();
  const readySourceIds = new Set(
    approvalQueue.queues.approved.filter((source) => source.canApproveForImport).map((source) => source.id)
  );

  if (input.createStarterBatches) {
    const existingBatches = await listImportBatches();
    const existingBatchNames = new Set(existingBatches.map((batch) => batch.name));

    for (const source of refreshedSources.filter((item) => readySourceIds.has(item.id))) {
      const name = starterBatchName(source);

      if (existingBatchNames.has(name)) {
        continue;
      }

      createdBatches.push(
        await createImportBatch({
          dataSourceId: source.id,
          name,
          sourceKind: source.sourceType,
          estimatedRecords: Math.min(
            starterBatchSize,
            launchSourceDefinitions.find((definition) => normalizedUrl(definition.baseUrl) === normalizedUrl(source.baseUrl))
              ?.starterRecords ?? starterBatchSize
          )
        })
      );
      existingBatchNames.add(name);
    }
  }

  const blockers = approvalQueue.nextActions.filter((action) => action.toLowerCase().includes("missing"));

  return {
    generatedAt: new Date().toISOString(),
    sourcesReviewed: launchSourceDefinitions.length,
    sourcesCreated,
    sourcesUpdated,
    readyForImport: readySourceIds.size,
    starterBatchesCreated: createdBatches.length,
    sources: sourceActions,
    createdBatches,
    blockers,
    nextActions: [
      ...(createdBatches.length ? ["Run starter import batches, then inspect extracted entity quality results."] : []),
      ...(!input.createStarterBatches ? ["Re-run with createStarterBatches=true after reviewing launch source readiness."] : []),
      ...(readySourceIds.size ? ["Use the import launch plan to queue full 5,000-listing waves."] : []),
      ...(!readySourceIds.size ? ["Resolve source approval blockers before creating launch import batches."] : [])
    ]
  };
}
