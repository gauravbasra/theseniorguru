export type ScheduledWorkerRunStatus = "succeeded" | "failed";

export type ScheduledWorkerRunRecord = {
  id: string;
  workerKey: string;
  status: ScheduledWorkerRunStatus;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  summary: Record<string, unknown>;
  error?: string;
  createdAt: string;
};

export type RecordScheduledWorkerRunInput = {
  workerKey: string;
  status: ScheduledWorkerRunStatus;
  startedAt: string;
  finishedAt?: string;
  summary?: Record<string, unknown>;
  error?: string;
};
