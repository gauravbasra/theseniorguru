import { getVendorFeedReadiness, runVendorFeedImport } from "@/lib/aggregation/vendor-feed-connections";
import type {
  ImportBatchRunResult,
  VendorFeedWorkerFeedInput,
  VendorFeedWorkerRunInput,
  VendorFeedWorkerRunResult,
  VendorFeedWorkerSourceSummary
} from "@/lib/domain/imports";

function normalizeMaxFeeds(maxFeeds?: number) {
  if (!Number.isFinite(maxFeeds)) return undefined;
  const rounded = Math.floor(Number(maxFeeds));
  return rounded > 0 ? rounded : undefined;
}

function recordsForSource(inputFeeds: VendorFeedWorkerFeedInput[], dataSourceId: string) {
  return inputFeeds.find((feed) => feed.dataSourceId === dataSourceId);
}

function emptyTotals() {
  return {
    totalRecords: 0,
    stagedRecords: 0,
    skippedRecords: 0,
    rejectedRecords: 0,
    errorRecords: 0
  };
}

function addRunTotals(totals: ReturnType<typeof emptyTotals>, run?: ImportBatchRunResult) {
  if (!run) return;
  totals.totalRecords += run.totalRecords;
  totals.stagedRecords += run.stagedRecords;
  totals.skippedRecords += run.skippedRecords;
  totals.rejectedRecords += run.rejectedRecords;
  totals.errorRecords += run.errorRecords;
}

export async function runVendorFeedWorker(input: VendorFeedWorkerRunInput = {}): Promise<VendorFeedWorkerRunResult> {
  const dryRun = input.dryRun ?? true;
  const maxFeeds = normalizeMaxFeeds(input.maxFeeds);
  const inputFeeds = Array.isArray(input.feeds) ? input.feeds : [];
  const readiness = await getVendorFeedReadiness();
  const sources = maxFeeds ? readiness.sources.slice(0, maxFeeds) : readiness.sources;
  const summaries: VendorFeedWorkerSourceSummary[] = [];
  const blockers: string[] = [];
  const totals = emptyTotals();

  for (const source of sources) {
    const feedInput = recordsForSource(inputFeeds, source.dataSourceId);
    const recordsProvided = Array.isArray(feedInput?.records) ? feedInput.records.length : 0;

    if (source.status !== "ready") {
      const reason = source.blockers[0] ?? "Vendor feed source is blocked by readiness gates.";
      blockers.push(`${source.dataSourceName}: ${reason}`);
      summaries.push({
        dataSourceId: source.dataSourceId,
        dataSourceName: source.dataSourceName,
        vendorName: source.vendorName,
        readinessStatus: source.status,
        action: "blocked",
        reason,
        recordsProvided
      });
      continue;
    }

    if (!recordsProvided) {
      const reason = "No vendor payload records were supplied for this ready source.";
      summaries.push({
        dataSourceId: source.dataSourceId,
        dataSourceName: source.dataSourceName,
        vendorName: source.vendorName,
        readinessStatus: source.status,
        action: "skipped",
        reason,
        recordsProvided
      });
      continue;
    }

    const run = await runVendorFeedImport({
      dataSourceId: source.dataSourceId,
      records: feedInput?.records ?? [],
      dryRun,
      actorId: input.actorId,
      batchName: feedInput?.batchName
    });
    addRunTotals(totals, run.run);
    summaries.push({
      dataSourceId: source.dataSourceId,
      dataSourceName: source.dataSourceName,
      vendorName: source.vendorName,
      readinessStatus: source.status,
      action: "executed",
      recordsProvided,
      run
    });
  }

  const readyFeeds = summaries.filter((summary) => summary.readinessStatus === "ready").length;
  const blockedFeeds = summaries.filter((summary) => summary.action === "blocked").length;
  const skippedFeeds = summaries.filter((summary) => summary.action === "skipped").length;
  const executedFeeds = summaries.filter((summary) => summary.action === "executed").length;

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    feedsReviewed: summaries.length,
    readyFeeds,
    blockedFeeds,
    skippedFeeds,
    executedFeeds,
    totals,
    feeds: summaries,
    blockers,
    nextActions: [
      ...(executedFeeds ? ["Review vendor feed run coverage, rejected records, and staged entities before scheduling unattended imports."] : []),
      ...(skippedFeeds ? ["Attach vendor payload records for ready feeds before running the scheduled worker."] : []),
      ...(blockedFeeds ? ["Resolve vendor contract, credential vault, field mapping, and source review blockers before import."] : []),
      ...(!summaries.length ? ["Register vendor data sources and vendor feed metadata before scheduling vendor imports."] : [])
    ]
  };
}
