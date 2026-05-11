"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { Ban, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { ScheduledWorkerRunRecord } from "@/lib/domain/scheduler";
import type { DataSourceRecord, DataSourceReviewStatus } from "@/lib/domain/providers";

type SourceGovernanceConsoleProps = {
  initialSources: DataSourceRecord[];
  initialRuns: ScheduledWorkerRunRecord[];
};

type ActionState = {
  key: string;
  message: string;
  ok: boolean;
} | null;

const sourceStatusOrder: DataSourceReviewStatus[] = ["approved", "pending", "needs_legal_review", "blocked"];

export function SourceGovernanceConsole({ initialSources, initialRuns }: SourceGovernanceConsoleProps) {
  const [sources, setSources] = useState(initialSources);
  const [runs, setRuns] = useState(initialRuns);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [actionState, setActionState] = useState<ActionState>(null);

  const sourceCounts = useMemo(
    () =>
      sourceStatusOrder.map((status) => ({
        status,
        count: sources.filter((source) => source.reviewStatus === status).length
      })),
    [sources]
  );
  const workerStats = useMemo(() => summarizeWorkerRuns(runs), [runs]);
  const reviewQueue = sources
    .filter((source) => source.reviewStatus === "pending" || source.reviewStatus === "needs_legal_review")
    .slice(0, 6);

  async function refreshData() {
    setLoadingKey("refresh");
    const [sourceResponse, runResponse] = await Promise.all([
      fetch("/api/v1/admin/data-sources"),
      fetch("/api/v1/admin/scheduled-worker-runs?limit=20")
    ]);
    const [sourcePayload, runPayload] = await Promise.all([
      sourceResponse.json().catch(() => ({})),
      runResponse.json().catch(() => ({}))
    ]);

    if (sourceResponse.ok && Array.isArray(sourcePayload.data)) {
      setSources(sourcePayload.data);
    }

    if (runResponse.ok && Array.isArray(runPayload.data)) {
      setRuns(runPayload.data);
    }

    setLoadingKey(null);
    setActionState({
      key: "refresh",
      ok: sourceResponse.ok && runResponse.ok,
      message: sourceResponse.ok && runResponse.ok ? "Governance data refreshed." : "Refresh hit an API error."
    });
  }

  async function decideSource(source: DataSourceRecord, decision: "approve" | "block") {
    const key = `${decision}-${source.id}`;
    setLoadingKey(key);
    const response = await fetch(`/api/v1/admin/data-sources/${source.id}/${decision}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actorId: "owner-admin-console",
        robotsStatus: decision === "approve" ? source.robotsStatus ?? "allowed" : "blocked",
        decisionNotes:
          decision === "approve"
            ? "Approved from admin source governance console."
            : "Blocked from admin source governance console."
      })
    });
    const payload = await response.json().catch(() => ({}));
    setLoadingKey(null);

    if (response.ok && payload.data) {
      setSources((current) => current.map((item) => (item.id === source.id ? payload.data : item)));
    }

    setActionState({
      key,
      ok: response.ok,
      message: response.ok
        ? `${source.name} ${decision === "approve" ? "approved for acquisition" : "blocked from acquisition"}.`
        : payload.error ?? "Source decision failed."
    });
  }

  return (
    <div className="governance-console">
      <article className="governance-panel source-review-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Acquisition guardrails</p>
            <h3>Source review board</h3>
          </div>
          <button className="icon-text-button" type="button" onClick={refreshData} disabled={loadingKey === "refresh"}>
            {loadingKey === "refresh" ? <Loader2 className="spin-icon" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
            Refresh
          </button>
        </div>

        <div className="governance-status-grid">
          {sourceCounts.map((item) => (
            <div className={`governance-status-card ${item.status}`} key={item.status}>
              <strong>{item.count}</strong>
              <span>{item.status.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>

        <div className="source-review-list">
          {reviewQueue.length ? (
            reviewQueue.map((source) => (
              <article className="source-review-row" key={source.id}>
                <div>
                  <strong>{source.name}</strong>
                  <span>{source.baseUrl ?? source.sourceType} - {source.reviewStatus.replaceAll("_", " ")}</span>
                  {source.termsNotes ? <small>{source.termsNotes}</small> : null}
                </div>
                <div className="source-review-actions">
                  <button
                    className="small-action approve"
                    type="button"
                    disabled={Boolean(loadingKey)}
                    onClick={() => decideSource(source, "approve")}
                  >
                    {loadingKey === `approve-${source.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
                    Approve
                  </button>
                  <button
                    className="small-action block"
                    type="button"
                    disabled={Boolean(loadingKey)}
                    onClick={() => decideSource(source, "block")}
                  >
                    {loadingKey === `block-${source.id}` ? <Loader2 className="spin-icon" aria-hidden="true" /> : <Ban aria-hidden="true" />}
                    Block
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="empty-governance-state">
              <ShieldCheck aria-hidden="true" />
              <strong>No source reviews waiting</strong>
              <span>Approved sources can run through the import pipeline.</span>
            </div>
          )}
        </div>

        {actionState ? (
          <p className={actionState.ok ? "governance-message ok" : "governance-message error"}>{actionState.message}</p>
        ) : null}
      </article>

      <article className="governance-panel worker-runs-panel">
        <div className="panel-title-row">
          <div>
            <p className="eyebrow">Automation health</p>
            <h3>Scheduled worker runs</h3>
          </div>
          <strong className="panel-stat small">{runs.length}</strong>
        </div>

        <div className="worker-health-chart" aria-label="Scheduled worker success and failure chart">
          <div>
            <span>Succeeded</span>
            <i style={{ "--value": `${workerStats.successPercent}%` } as CSSProperties} />
            <strong>{workerStats.succeeded}</strong>
          </div>
          <div>
            <span>Failed</span>
            <i style={{ "--value": `${workerStats.failurePercent}%` } as CSSProperties} />
            <strong>{workerStats.failed}</strong>
          </div>
        </div>

        <div className="worker-run-list">
          {runs.length ? (
            runs.slice(0, 8).map((run) => (
              <article className={`worker-run-row ${run.status}`} key={run.id}>
                <span>
                  <strong>{run.workerKey.replaceAll("_", " ")}</strong>
                  <small>{formatRunTime(run.finishedAt)} - {run.durationMs}ms</small>
                </span>
                <b>{run.status}</b>
              </article>
            ))
          ) : (
            <div className="empty-governance-state compact">
              <strong>No scheduled runs recorded yet</strong>
              <span>Cron executions will appear here after the next worker run.</span>
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

function summarizeWorkerRuns(runs: ScheduledWorkerRunRecord[]) {
  const succeeded = runs.filter((run) => run.status === "succeeded").length;
  const failed = runs.filter((run) => run.status === "failed").length;
  const total = Math.max(1, succeeded + failed);

  return {
    succeeded,
    failed,
    successPercent: Math.round((succeeded / total) * 100),
    failurePercent: Math.round((failed / total) * 100)
  };
}

function formatRunTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "time pending";
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}
