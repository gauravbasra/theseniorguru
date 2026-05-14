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

export type ScheduledWorkerHealthStatus = "healthy" | "stale" | "failing" | "never_run";

export type ScheduledWorkerHealthItem = {
  workerKey: string;
  label: string;
  expectedCadenceMinutes: number;
  status: ScheduledWorkerHealthStatus;
  latestRun?: ScheduledWorkerRunRecord;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  minutesSinceLastRun?: number;
  recentFailures: number;
  recentRuns: number;
  nextAction: string;
};

export type ScheduledWorkerHealthSummary = {
  generatedAt: string;
  status: "ready" | "action_required" | "blocked";
  workers: ScheduledWorkerHealthItem[];
  totals: {
    expectedWorkers: number;
    healthy: number;
    stale: number;
    failing: number;
    neverRun: number;
  };
  blockers: string[];
  nextActions: string[];
};
