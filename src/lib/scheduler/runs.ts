import crypto from "node:crypto";
import type {
  RecordScheduledWorkerRunInput,
  ScheduledWorkerHealthItem,
  ScheduledWorkerHealthSummary,
  ScheduledWorkerRunRecord
} from "@/lib/domain/scheduler";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedScheduledWorkerRuns: ScheduledWorkerRunRecord[] = [];

const expectedWorkers = [
  { workerKey: "cron:operations", label: "Operations cron", expectedCadenceMinutes: 60 },
  { workerKey: "cron:acquisition", label: "Acquisition cron", expectedCadenceMinutes: 24 * 60 },
  { workerKey: "cron:source-manifest-fetch", label: "Source manifest fetch cron", expectedCadenceMinutes: 24 * 60 },
  { workerKey: "cron:import-escalation-retry", label: "Import escalation retry cron", expectedCadenceMinutes: 60 },
  { workerKey: "cron:newsroom-rss", label: "Newsroom RSS cron", expectedCadenceMinutes: 24 * 60 },
  { workerKey: "cron:webhook-retry", label: "Webhook retry cron", expectedCadenceMinutes: 60 }
];

function durationMs(startedAt: string, finishedAt: string) {
  const started = Date.parse(startedAt);
  const finished = Date.parse(finishedAt);

  if (Number.isNaN(started) || Number.isNaN(finished)) {
    return 0;
  }

  return Math.max(0, finished - started);
}

function mapScheduledWorkerRun(row: Record<string, unknown>): ScheduledWorkerRunRecord {
  return {
    id: String(row.id),
    workerKey: String(row.worker_key),
    status: row.status as ScheduledWorkerRunRecord["status"],
    startedAt: String(row.started_at),
    finishedAt: String(row.finished_at),
    durationMs: Number(row.duration_ms ?? 0),
    summary: row.summary && typeof row.summary === "object" ? (row.summary as Record<string, unknown>) : {},
    error: row.error ? String(row.error) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function recordScheduledWorkerRun(input: RecordScheduledWorkerRunInput): Promise<ScheduledWorkerRunRecord> {
  const finishedAt = input.finishedAt ?? new Date().toISOString();
  const record = {
    id: `scheduled-worker-run-${crypto.randomUUID()}`,
    workerKey: input.workerKey,
    status: input.status,
    startedAt: input.startedAt,
    finishedAt,
    durationMs: durationMs(input.startedAt, finishedAt),
    summary: input.summary ?? {},
    error: input.error,
    createdAt: new Date().toISOString()
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    seedScheduledWorkerRuns.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("scheduled_worker_runs")
    .insert({
      worker_key: record.workerKey,
      status: record.status,
      started_at: record.startedAt,
      finished_at: record.finishedAt,
      duration_ms: record.durationMs,
      summary: record.summary,
      error: record.error
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Scheduled worker run logging failed: ${error.message}`);
  }

  return mapScheduledWorkerRun(data);
}

export async function listScheduledWorkerRuns(input: {
  workerKey?: string;
  status?: ScheduledWorkerRunRecord["status"];
  limit?: number;
} = {}): Promise<ScheduledWorkerRunRecord[]> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 50), 100));
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedScheduledWorkerRuns
      .filter((run) => !input.workerKey || run.workerKey === input.workerKey)
      .filter((run) => !input.status || run.status === input.status)
      .slice(0, limit);
  }

  let query = supabase.from("scheduled_worker_runs").select("*").order("created_at", { ascending: false }).limit(limit);

  if (input.workerKey) {
    query = query.eq("worker_key", input.workerKey);
  }

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Scheduled worker runs query failed: ${error.message}`);
  }

  return (data ?? []).map(mapScheduledWorkerRun);
}

function minutesSince(value?: string) {
  const timestamp = value ? Date.parse(value) : NaN;

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return Math.max(0, Math.round((Date.now() - timestamp) / (60 * 1000)));
}

function classifyWorker(worker: (typeof expectedWorkers)[number], runs: ScheduledWorkerRunRecord[]): ScheduledWorkerHealthItem {
  const workerRuns = runs.filter((run) => run.workerKey === worker.workerKey);
  const latestRun = workerRuns[0];
  const latestSuccess = workerRuns.find((run) => run.status === "succeeded");
  const latestFailure = workerRuns.find((run) => run.status === "failed");
  const recentFailures = workerRuns.slice(0, 5).filter((run) => run.status === "failed").length;
  const lastRunAge = minutesSince(latestRun?.finishedAt);
  const staleAfterMinutes = worker.expectedCadenceMinutes * 2;
  const status: ScheduledWorkerHealthItem["status"] = !latestRun
    ? "never_run"
    : latestRun.status === "failed" || recentFailures >= 3
      ? "failing"
      : typeof lastRunAge === "number" && lastRunAge > staleAfterMinutes
        ? "stale"
        : "healthy";

  return {
    ...worker,
    status,
    latestRun,
    lastSucceededAt: latestSuccess?.finishedAt,
    lastFailedAt: latestFailure?.finishedAt,
    minutesSinceLastRun: lastRunAge,
    recentFailures,
    recentRuns: workerRuns.length,
    nextAction:
      status === "healthy"
        ? "No action needed; keep monitoring scheduled run history."
        : status === "never_run"
          ? "Run or schedule this cron route so launch operations have a baseline health record."
          : status === "stale"
            ? "Trigger this cron route or verify Vercel Cron configuration and CRON_SECRET."
            : "Inspect the latest failed run error and rerun after fixing the blocker."
  };
}

export async function getScheduledWorkerHealth(): Promise<ScheduledWorkerHealthSummary> {
  const runs = await listScheduledWorkerRuns({ limit: 100 });
  const workers = expectedWorkers.map((worker) => classifyWorker(worker, runs));
  const totals = {
    expectedWorkers: workers.length,
    healthy: workers.filter((worker) => worker.status === "healthy").length,
    stale: workers.filter((worker) => worker.status === "stale").length,
    failing: workers.filter((worker) => worker.status === "failing").length,
    neverRun: workers.filter((worker) => worker.status === "never_run").length
  };
  const blockers = workers
    .filter((worker) => worker.status === "failing" || worker.status === "never_run")
    .map((worker) => `${worker.label}: ${worker.nextAction}`);

  return {
    generatedAt: new Date().toISOString(),
    status: totals.failing || totals.neverRun ? "blocked" : totals.stale ? "action_required" : "ready",
    workers,
    totals,
    blockers,
    nextActions: [
      ...(totals.failing ? ["Fix failing scheduled workers before relying on automated launch operations."] : []),
      ...(totals.neverRun ? ["Run each expected cron route at least once after CRON_SECRET is configured."] : []),
      ...(totals.stale ? ["Verify Vercel Cron cadence for stale workers."] : []),
      ...(!totals.failing && !totals.neverRun && !totals.stale ? ["Scheduled worker health is ready for launch monitoring."] : [])
    ]
  };
}
