import { listCrawlJobs } from "@/lib/aggregation/crawl-jobs";
import { getImportLaunchPlan } from "@/lib/aggregation/import-launch-plan";
import { previewCurrentSiteRealListings } from "@/lib/aggregation/public-source-acquisition";
import { listDataSources } from "@/lib/data-sources";
import type { CrawlJobStatus, ImportBatchStatus } from "@/lib/domain/imports";
import { listImportBatches } from "@/lib/import-batches";

type CountDatum<T extends string = string> = {
  label: T;
  value: number;
};

export type AcquisitionHealthSummary = {
  generatedAt: string;
  targetListings: number;
  discoveredListings: number;
  stagedRecords: number;
  importedRecords: number;
  remainingListings: number;
  approvedSources: number;
  blockedSources: number;
  pendingSources: number;
  imageReadyRecords: number;
  imageBacklogRecords: number;
  productionGradeRecords: number;
  sourceCoveragePercent: number;
  batchStatusMix: CountDatum<ImportBatchStatus>[];
  crawlStatusMix: CountDatum<CrawlJobStatus>[];
  blockers: string[];
  nextActions: string[];
};

const batchStatuses: ImportBatchStatus[] = [
  "draft",
  "queued",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "blocked_by_policy"
];
const crawlStatuses: CrawlJobStatus[] = ["queued", "running", "completed", "failed", "blocked_by_policy"];

function percent(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
}

export async function getAcquisitionHealth(): Promise<AcquisitionHealthSummary> {
  const [sources, batches, crawlJobs, launchPlan, currentSitePreview] = await Promise.all([
    listDataSources(),
    listImportBatches(),
    listCrawlJobs(),
    getImportLaunchPlan({ targetListings: 5000, batchSize: 500 }),
    previewCurrentSiteRealListings({ maxRecords: 25 })
  ]);
  const approvedSources = sources.filter((source) => source.reviewStatus === "approved");
  const blockedSources = sources.filter((source) => source.reviewStatus === "blocked");
  const pendingSources = sources.filter((source) => source.reviewStatus === "pending" || source.reviewStatus === "needs_legal_review");
  const stagedRecords = batches.reduce((total, batch) => total + batch.totalRecords, 0);
  const importedRecords = batches.reduce((total, batch) => total + batch.importedRecords, 0);
  const batchStatusMix = batchStatuses.map((status) => ({
    label: status,
    value: batches.filter((batch) => batch.status === status).length
  }));
  const crawlStatusMix = crawlStatuses.map((status) => ({
    label: status,
    value: crawlJobs.filter((job) => job.status === status).length
  }));
  const blockers = [
    ...launchPlan.blockers,
    ...(approvedSources.length ? [] : ["No approved acquisition sources are available for governed import workers."]),
    ...(currentSitePreview.sourcePolicies.some((policy) => policy.robotsDecision !== "allowed")
      ? ["Current-site public acquisition is blocked by robots policy."]
      : [])
  ];

  return {
    generatedAt: new Date().toISOString(),
    targetListings: launchPlan.targetListings,
    discoveredListings: currentSitePreview.discoveredListings,
    stagedRecords,
    importedRecords,
    remainingListings: launchPlan.remainingListings,
    approvedSources: approvedSources.length,
    blockedSources: blockedSources.length,
    pendingSources: pendingSources.length,
    imageReadyRecords: currentSitePreview.sourceCoverage.imageReadyRecords,
    imageBacklogRecords: currentSitePreview.sourceCoverage.imageBacklogRecords,
    productionGradeRecords: currentSitePreview.sourceCoverage.productionGradeRecords,
    sourceCoveragePercent: percent(
      currentSitePreview.sourceCoverage.productionGradeRecords,
      currentSitePreview.sourceCoverage.totalRecords
    ),
    batchStatusMix,
    crawlStatusMix,
    blockers: [...new Set(blockers)],
    nextActions: [
      ...launchPlan.nextActions,
      currentSitePreview.imageCoverage.listingsMissingThreeImages > 0
        ? "Continue image enrichment separately; source image URLs are stored for review before reuse."
        : "Current preview records have the requested image coverage.",
      "Use current-site staging for owned inventory, then add official source adapters as each source is legally approved."
    ]
  };
}
