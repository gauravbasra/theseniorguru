import { listCrawlJobs, listDataQualityFlags } from "@/lib/aggregation/crawl-jobs";
import { listDataSources } from "@/lib/data-sources";
import { listImportBatches } from "@/lib/import-batches";

type AggregationBlocker = {
  key: string;
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  owner: "admin" | "owner" | "system";
};

function percent(numerator: number, denominator: number) {
  if (!denominator) {
    return 0;
  }

  return Math.round((numerator / denominator) * 100);
}

export async function getAggregationLaunchReadiness() {
  const [dataSources, importBatches, crawlJobs, qualityFlags] = await Promise.all([
    listDataSources(),
    listImportBatches(),
    listCrawlJobs(),
    listDataQualityFlags()
  ]);

  const approvedSources = dataSources.filter((source) => source.reviewStatus === "approved");
  const blockedSources = dataSources.filter((source) =>
    ["blocked", "needs_legal_review"].includes(source.reviewStatus)
  );
  const importTotals = importBatches.reduce(
    (totals, batch) => ({
      totalRecords: totals.totalRecords + batch.totalRecords,
      importedRecords: totals.importedRecords + batch.importedRecords,
      rejectedRecords: totals.rejectedRecords + batch.rejectedRecords,
      errorRecords: totals.errorRecords + batch.errorRecords
    }),
    { totalRecords: 0, importedRecords: 0, rejectedRecords: 0, errorRecords: 0 }
  );
  const completedImports = importBatches.filter((batch) => batch.status === "completed").length;
  const failedImports = importBatches.filter((batch) => ["failed", "blocked_by_policy"].includes(batch.status)).length;
  const runnableCrawlJobs = crawlJobs.filter((job) => job.status === "queued" || job.status === "failed");
  const completedCrawlJobs = crawlJobs.filter((job) => job.status === "completed").length;
  const criticalFlags = qualityFlags.filter((flag) => flag.severity === "critical" || flag.severity === "high");

  const blockers: AggregationBlocker[] = [];

  if (!approvedSources.length) {
    blockers.push({
      key: "no_approved_data_sources",
      severity: "critical",
      message: "At least one approved data source is required before launch import jobs can run.",
      owner: "admin"
    });
  }

  if (!importBatches.length) {
    blockers.push({
      key: "no_import_batches",
      severity: "high",
      message: "Create import batches for approved sources so launch inventory can move into staging.",
      owner: "admin"
    });
  }

  if (failedImports > 0) {
    blockers.push({
      key: "failed_import_batches",
      severity: "high",
      message: `${failedImports} import batch${failedImports === 1 ? "" : "es"} failed or were blocked by policy.`,
      owner: "system"
    });
  }

  if (criticalFlags.length) {
    blockers.push({
      key: "critical_data_quality_flags",
      severity: "critical",
      message: `${criticalFlags.length} high or critical data quality flag${criticalFlags.length === 1 ? "" : "s"} need review.`,
      owner: "admin"
    });
  }

  if (blockedSources.length) {
    blockers.push({
      key: "blocked_or_legal_review_sources",
      severity: "medium",
      message: `${blockedSources.length} data source${blockedSources.length === 1 ? "" : "s"} are blocked or need legal review.`,
      owner: "owner"
    });
  }

  const launchTarget = {
    importedListings: 5000,
    enrichedListings: 1000,
    claimedListings: 100
  };

  const progress = {
    importedListings: importTotals.importedRecords,
    importedPercent: percent(importTotals.importedRecords, launchTarget.importedListings),
    stagedRecords: importTotals.totalRecords,
    errorRate: percent(importTotals.errorRecords, Math.max(importTotals.totalRecords, 1)),
    rejectionRate: percent(importTotals.rejectedRecords, Math.max(importTotals.totalRecords, 1))
  };

  return {
    generatedAt: new Date().toISOString(),
    status: blockers.some((blocker) => blocker.severity === "critical")
      ? "blocked"
      : blockers.length
        ? "action_required"
        : "ready",
    launchTarget,
    progress,
    sources: {
      total: dataSources.length,
      approved: approvedSources.length,
      blockedOrLegalReview: blockedSources.length,
      approvedSourceNames: approvedSources.map((source) => source.name)
    },
    imports: {
      total: importBatches.length,
      completed: completedImports,
      failedOrBlocked: failedImports,
      ...importTotals
    },
    crawlers: {
      total: crawlJobs.length,
      runnable: runnableCrawlJobs.length,
      completed: completedCrawlJobs,
      pagesSeen: crawlJobs.reduce((total, job) => total + job.pagesSeen, 0),
      pagesImported: crawlJobs.reduce((total, job) => total + job.pagesImported, 0)
    },
    quality: {
      unresolvedFlags: qualityFlags.length,
      highOrCritical: criticalFlags.length,
      flags: qualityFlags.slice(0, 20)
    },
    blockers,
    nextActions: blockers.length
      ? blockers.map((blocker) => blocker.message)
      : ["Run the next approved import batch or crawler job and continue enrichment toward launch targets."]
  };
}
