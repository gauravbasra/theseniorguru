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

export type RecordAuditEventInput = {
  actorId?: string;
  actorType?: AuditActorType;
  eventType: string;
  subjectType?: string;
  subjectId?: string;
  payload?: Record<string, unknown>;
};
