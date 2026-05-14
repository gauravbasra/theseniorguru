export type AuditActorType = "system" | "admin" | "provider" | "family" | "partner";

export type OperationalAuditEvent = {
  id: string;
  actorId?: string;
  actorType: AuditActorType;
  eventType: string;
  subjectType?: string;
  subjectId?: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AuditEventSummary = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  totals: {
    events: number;
    system: number;
    admin: number;
    provider: number;
    family: number;
    partner: number;
  };
  events: OperationalAuditEvent[];
  nextActions: string[];
};

export type AuditEventExportFormat = "json" | "csv";

export type AuditEventExportResult = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  format: AuditEventExportFormat;
  retentionDays: number;
  retentionCutoff: string;
  totals: {
    events: number;
    retained: number;
    retentionCandidates: number;
  };
  events: OperationalAuditEvent[];
  csv?: string;
  nextActions: string[];
};

export type AuditRetentionControlResult = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  dryRun: boolean;
  retentionDays: number;
  retentionCutoff: string;
  status: "preview" | "blocked";
  totals: {
    scanned: number;
    retained: number;
    retentionCandidates: number;
  };
  retentionCandidates: OperationalAuditEvent[];
  blockers: string[];
  nextActions: string[];
};

export type RecordAuditEventInput = {
  actorId?: string;
  actorType?: AuditActorType;
  eventType: string;
  subjectType?: string;
  subjectId?: string;
  payload?: Record<string, unknown>;
};
