"use client";

import { useMemo, useState } from "react";
import { DatabaseZap, Loader2, Play, RefreshCw, RotateCcw } from "lucide-react";
import type { CrawlJobRecord, ImportBatchRecord, ImportBatchStatus } from "@/lib/domain/imports";
import type { DataSourceRecord } from "@/lib/domain/providers";

type AcquisitionPipelineConsoleProps = {
  initialSources: DataSourceRecord[];
  initialBatches: ImportBatchRecord[];
  initialCrawlJobs: CrawlJobRecord[];
};

type ActionState = {
  ok: boolean;
  message: string;
} | null;

const batchStatuses: ImportBatchStatus[] = [
  "queued",
  "running",
  "completed",
  "completed_with_errors",
  "failed",
  "blocked_by_policy"
];

export function AcquisitionPipelineConsole({
  initialSources,
  initialBatches,
  initialCrawlJobs
}: AcquisitionPipelineConsoleProps) {
  const approvedSources = initialSources.filter((source) => source.reviewStatus === "approved");
  const [batches, setBatches] = useState(initialBatches);
  const [crawlJobs, setCrawlJobs] = useState(initialCrawlJobs);
  const [selectedSourceId, setSelectedSourceId] = useState(approvedSources[0]?.id ?? "");
  const [seedUrl, setSeedUrl] = useState(approvedSources[0]?.baseUrl ?? "https://theseniorguru.com/search");
  const [maxPages, setMaxPages] = useState(5);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  const batchCounts = useMemo(
    () =>
      batchStatuses.map((status) => ({
        status,
        count: batches.filter((batch) => batch.status === status).length
      })),
    [batches]
  );
  const latestRunnableJob = crawlJobs.find((job) => job.status === "queued" || job.status === "failed");
  const retryableBatches = batches.filter((batch) =>
    ["failed", "completed_with_errors", "blocked_by_policy", "running"].includes(batch.status)
  );

  async function refreshQueues() {
    setLoadingKey("refresh-acquisition");
    const [batchResponse, crawlResponse] = await Promise.all([
      fetch("/api/v1/admin/import-batches"),
      fetch("/api/v1/admin/crawl-jobs")
    ]);
    const [batchPayload, crawlPayload] = await Promise.all([
      batchResponse.json().catch(() => ({})),
      crawlResponse.json().catch(() => ({}))
    ]);

    if (batchResponse.ok && Array.isArray(batchPayload.data)) {
      setBatches(batchPayload.data);
    }

    if (crawlResponse.ok && Array.isArray(crawlPayload.data)) {
      setCrawlJobs(crawlPayload.data);
    }

    setLoadingKey(null);
    setActionState({
      ok: batchResponse.ok && crawlResponse.ok,
      message: batchResponse.ok && crawlResponse.ok ? "Acquisition queues refreshed." : "Queue refresh hit an API error."
    });
  }

  async function createCrawlJob() {
    setLoadingKey("create-crawl");
    const response = await fetch("/api/v1/admin/crawl-jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        dataSourceId: selectedSourceId,
        seedUrl,
        maxPages,
        actorId: "owner-admin-console"
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data) {
      setCrawlJobs((current) => [payload.data, ...current]);
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? "Crawl job queued behind policy and source approval checks." : payload.error ?? "Crawl job failed."
    });
  }

  async function runCrawl(jobId: string) {
    const key = `run-crawl-${jobId}`;
    setLoadingKey(key);
    const response = await fetch(`/api/v1/admin/crawl-jobs/${jobId}/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dryRun: true, actorId: "owner-admin-console" })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data) {
      setCrawlJobs((current) =>
        current.map((job) =>
          job.id === jobId
            ? {
                ...job,
                status: payload.data.status,
                pagesSeen: payload.data.pagesSeen,
                pagesImported: payload.data.pagesImported,
                completedAt: new Date().toISOString()
              }
            : job
        )
      );
    }

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `Dry-run crawl finished with ${payload.data?.pagesImported ?? 0} page staged.`
        : payload.error ?? "Crawl run failed."
    });
  }

  async function runCurrentSiteStage() {
    setLoadingKey("current-site-stage");
    const response = await fetch("/api/v1/admin/public-source-acquisition/current-site-run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ maxRecords: 25, dryRun: false, actorId: "owner-admin-console" })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok) {
      await refreshQueues();
    }

    setActionState({
      ok: response.ok,
      message: response.ok
        ? `${payload.data?.stagedRecords ?? 0} current-site records staged for launch inventory.`
        : payload.error ?? "Current-site staging failed."
    });
  }

  async function requeueBatch(batchId: string) {
    const key = `requeue-${batchId}`;
    setLoadingKey(key);
    const response = await fetch(`/api/v1/admin/import-batches/${batchId}/requeue`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actorId: "owner-admin-console", reason: "Admin acquisition console retry" })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data?.batch) {
      setBatches((current) => current.map((batch) => (batch.id === batchId ? payload.data.batch : batch)));
    }

    setActionState({
      ok: response.ok,
      message: response.ok ? "Import batch requeued for another governed run." : payload.error ?? "Requeue failed."
    });
  }

  return (
    <div className="acquisition-console">
      <article className="acquisition-panel acquisition-controls-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Crawler control</p>
            <h3>Approved-source jobs</h3>
          </div>
          <button className="icon-text-button" type="button" disabled={loadingKey === "refresh-acquisition"} onClick={refreshQueues}>
            {loadingKey === "refresh-acquisition" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <label className="field-stack">
          <span>Approved source</span>
          <select value={selectedSourceId} onChange={(event) => setSelectedSourceId(event.target.value)}>
            {approvedSources.map((source) => (
              <option key={source.id} value={source.id}>{source.name}</option>
            ))}
          </select>
        </label>

        <label className="field-stack">
          <span>Seed URL</span>
          <input value={seedUrl} onChange={(event) => setSeedUrl(event.target.value)} placeholder="https://example.com/senior-living" />
        </label>

        <label className="field-stack">
          <span>Max pages</span>
          <input
            min={1}
            max={50}
            type="number"
            value={maxPages}
            onChange={(event) => setMaxPages(Number(event.target.value))}
          />
        </label>

        <div className="acquisition-action-row">
          <button
            className="button primary"
            type="button"
            disabled={!selectedSourceId || !seedUrl || Boolean(loadingKey)}
            onClick={createCrawlJob}
          >
            {loadingKey === "create-crawl" ? "Queueing..." : "Queue crawl job"}
          </button>
          <button className="button secondary" type="button" disabled={Boolean(loadingKey)} onClick={runCurrentSiteStage}>
            {loadingKey === "current-site-stage" ? "Staging..." : "Stage 25 current listings"}
          </button>
        </div>

        {latestRunnableJob ? (
          <button
            className="run-job-strip"
            type="button"
            disabled={Boolean(loadingKey)}
            onClick={() => runCrawl(latestRunnableJob.id)}
          >
            {loadingKey === `run-crawl-${latestRunnableJob.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Play aria-hidden="true" />}
            Run dry crawl for {new URL(latestRunnableJob.seedUrl).hostname}
          </button>
        ) : null}

        {actionState ? <p className={actionState.ok ? "governance-message ok" : "governance-message error"}>{actionState.message}</p> : null}
      </article>

      <article className="acquisition-panel">
        <p className="eyebrow">Import batches</p>
        <h3>Status mix</h3>
        <div className="batch-status-grid">
          {batchCounts.map((item) => (
            <div className={`batch-status-card ${item.status}`} key={item.status}>
              <strong>{item.count}</strong>
              <span>{item.status.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>
        <div className="pipeline-list">
          {batches.slice(0, 6).map((batch) => (
            <article className="pipeline-row" key={batch.id}>
              <span>
                <strong>{batch.name}</strong>
                <small>{batch.importedRecords}/{batch.totalRecords} imported - {batch.status.replaceAll("_", " ")}</small>
              </span>
              {retryableBatches.some((item) => item.id === batch.id) ? (
                <button className="tiny-icon-button" type="button" disabled={Boolean(loadingKey)} onClick={() => requeueBatch(batch.id)}>
                  {loadingKey === `requeue-${batch.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RotateCcw aria-hidden="true" />}
                  Retry
                </button>
              ) : null}
            </article>
          ))}
          {!batches.length ? (
            <div className="empty-governance-state compact">
              <DatabaseZap aria-hidden="true" />
              <strong>No import batches yet</strong>
              <span>Stage current listings or create a launch plan to populate this queue.</span>
            </div>
          ) : null}
        </div>
      </article>

      <article className="acquisition-panel">
        <p className="eyebrow">Crawl jobs</p>
        <h3>Recent runs</h3>
        <div className="pipeline-list">
          {crawlJobs.slice(0, 7).map((job) => (
            <article className={`pipeline-row ${job.status}`} key={job.id}>
              <span>
                <strong>{new URL(job.seedUrl).hostname}</strong>
                <small>{job.pagesImported}/{job.pagesSeen || job.maxPages} pages - {job.status.replaceAll("_", " ")}</small>
              </span>
              {(job.status === "queued" || job.status === "failed") ? (
                <button className="tiny-icon-button" type="button" disabled={Boolean(loadingKey)} onClick={() => runCrawl(job.id)}>
                  {loadingKey === `run-crawl-${job.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Play aria-hidden="true" />}
                  Run
                </button>
              ) : null}
            </article>
          ))}
          {!crawlJobs.length ? (
            <div className="empty-governance-state compact">
              <strong>No crawl jobs queued</strong>
              <span>Use an approved source to start a governed crawl.</span>
            </div>
          ) : null}
        </div>
      </article>
    </div>
  );
}
