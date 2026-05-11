import crypto from "node:crypto";
import type { RecordScheduledWorkerRunInput, ScheduledWorkerRunRecord } from "@/lib/domain/scheduler";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedScheduledWorkerRuns: ScheduledWorkerRunRecord[] = [];

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
