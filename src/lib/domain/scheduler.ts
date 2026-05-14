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

export type ScheduledWorkerAlertDeliveryProvider = "manual_export" | "internal_notification_queue";

export type ScheduledWorkerAlertItem = {
  workerKey: string;
  label: string;
  status: ScheduledWorkerHealthStatus;
  severity: "info" | "warning" | "critical";
  latestRunId?: string;
  lastSucceededAt?: string;
  lastFailedAt?: string;
  minutesSinceLastRun?: number;
  recentFailures: number;
  nextAction: string;
};

export type NotifyScheduledWorkerAlertsInput = {
  dryRun?: boolean;
  deliveryProvider?: ScheduledWorkerAlertDeliveryProvider;
  actorId?: string;
};

export type ScheduledWorkerAlertDeliveryResult = {
  generatedAt: string;
  dryRun: boolean;
  deliveryProvider: ScheduledWorkerAlertDeliveryProvider;
  status: "no_action" | "ready" | "sent" | "blocked";
  recipients: string[];
  workerHealth: ScheduledWorkerHealthSummary;
  payloadPreview: {
    subject: string;
    alertCount: number;
    blockedWorkers: number;
    staleWorkers: number;
    items: ScheduledWorkerAlertItem[];
  };
  blockers: string[];
  nextActions: string[];
};
