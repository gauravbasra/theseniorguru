import {
  getSourceAdapterImportReadiness,
  runSourceAdapterImport
} from "@/lib/aggregation/source-adapter-imports";
import type {
  ImportBatchRunResult,
  SourceAdapterWorkerPayloadInput,
  SourceAdapterWorkerRunInput,
  SourceAdapterWorkerRunResult,
  SourceAdapterWorkerAdapterSummary
} from "@/lib/domain/imports";

function normalizeMaxAdapters(maxAdapters?: number) {
  if (!Number.isFinite(maxAdapters)) return undefined;
  const rounded = Math.floor(Number(maxAdapters));
  return rounded > 0 ? rounded : undefined;
}

function payloadForSource(payloads: SourceAdapterWorkerPayloadInput[], dataSourceId: string) {
  return payloads.find((payload) => payload.dataSourceId === dataSourceId);
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

export async function runSourceAdapterWorker(input: SourceAdapterWorkerRunInput = {}): Promise<SourceAdapterWorkerRunResult> {
  const dryRun = input.dryRun ?? true;
  const maxAdapters = normalizeMaxAdapters(input.maxAdapters);
  const payloads = Array.isArray(input.payloads) ? input.payloads : [];
  const readiness = await getSourceAdapterImportReadiness();
  const adapters = maxAdapters ? readiness.adapters.slice(0, maxAdapters) : readiness.adapters;
  const summaries: SourceAdapterWorkerAdapterSummary[] = [];
  const blockers: string[] = [];
  const totals = emptyTotals();

  for (const adapter of adapters) {
    const payload = payloadForSource(payloads, adapter.dataSourceId);
    const recordsProvided = Array.isArray(payload?.records) ? payload.records.length : 0;

    if (adapter.status === "unsupported") {
      const reason = adapter.blockers[0] ?? "This source type uses a dedicated source-specific runner.";
      blockers.push(`${adapter.dataSourceName}: ${reason}`);
      summaries.push({
        dataSourceId: adapter.dataSourceId,
        dataSourceName: adapter.dataSourceName,
        sourceType: adapter.sourceType,
        adapterKey: adapter.adapterKey,
        readinessStatus: adapter.status,
        action: "unsupported",
        reason,
        recordsProvided
      });
      continue;
    }

    if (adapter.status === "blocked") {
      const reason = adapter.blockers[0] ?? "Source adapter is blocked by readiness gates.";
      blockers.push(`${adapter.dataSourceName}: ${reason}`);
      summaries.push({
        dataSourceId: adapter.dataSourceId,
        dataSourceName: adapter.dataSourceName,
        sourceType: adapter.sourceType,
        adapterKey: adapter.adapterKey,
        readinessStatus: adapter.status,
        action: "blocked",
        reason,
        recordsProvided
      });
      continue;
    }

    if (!recordsProvided) {
      const reason = "No source export payload records were supplied for this runnable adapter.";
      summaries.push({
        dataSourceId: adapter.dataSourceId,
        dataSourceName: adapter.dataSourceName,
        sourceType: adapter.sourceType,
        adapterKey: adapter.adapterKey,
        readinessStatus: adapter.status,
        action: "skipped",
        reason,
        recordsProvided
      });
      continue;
    }

    const run = await runSourceAdapterImport({
      dataSourceId: adapter.dataSourceId,
      records: payload?.records ?? [],
      dryRun,
      actorId: input.actorId,
      batchName: payload?.batchName
    });
    addRunTotals(totals, run.run);
    summaries.push({
      dataSourceId: adapter.dataSourceId,
      dataSourceName: adapter.dataSourceName,
      sourceType: adapter.sourceType,
      adapterKey: adapter.adapterKey,
      readinessStatus: adapter.status,
      action: "executed",
      recordsProvided,
      run
    });
  }

  const executedAdapters = summaries.filter((summary) => summary.action === "executed").length;
  const skippedAdapters = summaries.filter((summary) => summary.action === "skipped").length;
  const blockedAdapters = summaries.filter((summary) => summary.action === "blocked").length;
  const unsupportedAdapters = summaries.filter((summary) => summary.action === "unsupported").length;
  const runnableAdapters = summaries.filter((summary) => summary.readinessStatus === "runnable").length;

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    adaptersReviewed: summaries.length,
    runnableAdapters,
    blockedAdapters,
    unsupportedAdapters,
    skippedAdapters,
    executedAdapters,
    totals,
    adapters: summaries,
    blockers,
    nextActions: [
      ...(executedAdapters ? ["Review source adapter run coverage, rejected records, and staged entities before unattended scheduling."] : []),
      ...(skippedAdapters ? ["Attach source export payload records for runnable adapters before scheduled execution."] : []),
      ...(blockedAdapters ? ["Resolve source approval, robots, terms, and jurisdiction blockers before import."] : []),
      ...(unsupportedAdapters ? ["Route unsupported source types to vendor, provider website, or newsroom-specific runners."] : []),
      ...(!summaries.length ? ["Register and approve CMS, state, or owner-controlled data sources before scheduling source adapter imports."] : [])
    ]
  };
}
