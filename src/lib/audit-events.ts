import crypto from "node:crypto";
import type {
  AuditEventExportFormat,
  AuditEventExportResult,
  AuditEventSummary,
  AuditRetentionControlResult,
  OperationalAuditEvent,
  RecordAuditEventInput
} from "@/lib/domain/audit";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const localAuditEvents: OperationalAuditEvent[] = [];
const defaultAuditRetentionDays = 2555;

function isUuid(value?: string) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

function mapAuditEvent(row: Record<string, unknown>): OperationalAuditEvent {
  return {
    id: String(row.id),
    actorId: row.actor_id ? String(row.actor_id) : undefined,
    actorType: (row.actor_type as OperationalAuditEvent["actorType"]) ?? "system",
    eventType: String(row.event_type),
    subjectType: row.subject_type ? String(row.subject_type) : undefined,
    subjectId: row.subject_id ? String(row.subject_id) : undefined,
    payload: row.payload && typeof row.payload === "object" ? (row.payload as Record<string, unknown>) : {},
    createdAt: String(row.created_at ?? new Date().toISOString())
  };
}

function retentionCutoffFor(days = defaultAuditRetentionDays) {
  const retentionDays = Math.max(30, Math.min(Number(days), 3650));
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);

  return { retentionDays, retentionCutoff: cutoff.toISOString() };
}

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function auditEventsToCsv(events: OperationalAuditEvent[]) {
  const headers = ["id", "createdAt", "actorType", "actorId", "eventType", "subjectType", "subjectId", "payload"];
  const rows = events.map((event) =>
    [
      event.id,
      event.createdAt,
      event.actorType,
      event.actorId ?? "",
      event.eventType,
      event.subjectType ?? "",
      event.subjectId ?? "",
      event.payload
    ]
      .map(csvEscape)
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

export async function recordAuditEvent(input: RecordAuditEventInput): Promise<OperationalAuditEvent> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const event: OperationalAuditEvent = {
      id: `audit-event-${crypto.randomUUID()}`,
      actorId: input.actorId,
      actorType: input.actorType ?? "system",
      eventType: input.eventType,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      payload: input.payload ?? {},
      createdAt: new Date().toISOString()
    };

    localAuditEvents.unshift(event);
    return event;
  }

  const { data, error } = await supabase
    .from("audit_events")
    .insert({
      actor_id: isUuid(input.actorId) ? input.actorId : undefined,
      actor_type: input.actorType ?? "system",
      event_type: input.eventType,
      subject_type: input.subjectType,
      subject_id: isUuid(input.subjectId) ? input.subjectId : undefined,
      payload: input.payload ?? {}
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Audit event creation failed: ${error.message}`);
  }

  return mapAuditEvent(data);
}

export async function listAuditEvents(
  input: { eventType?: string; subjectType?: string; actorType?: string; createdBefore?: string; limit?: number } = {}
): Promise<AuditEventSummary> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 100), 250));
  const supabase = getSupabaseAdminClient();
  let source: AuditEventSummary["source"] = "local_fallback";
  let events: OperationalAuditEvent[];

  if (supabase) {
    source = "supabase";
    let query = supabase.from("audit_events").select("*").order("created_at", { ascending: false }).limit(limit);

    if (input.eventType) {
      query = query.eq("event_type", input.eventType);
    }

    if (input.subjectType) {
      query = query.eq("subject_type", input.subjectType);
    }

    if (input.actorType) {
      query = query.eq("actor_type", input.actorType);
    }

    if (input.createdBefore) {
      query = query.lt("created_at", input.createdBefore);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Audit event query failed: ${error.message}`);
    }

    events = (data ?? []).map(mapAuditEvent);
  } else {
    events = localAuditEvents
      .filter((event) => !input.eventType || event.eventType === input.eventType)
      .filter((event) => !input.subjectType || event.subjectType === input.subjectType)
      .filter((event) => !input.actorType || event.actorType === input.actorType)
      .filter((event) => !input.createdBefore || Date.parse(event.createdAt) < Date.parse(input.createdBefore))
      .slice(0, limit);
  }

  return {
    generatedAt: new Date().toISOString(),
    source,
    totals: {
      events: events.length,
      system: events.filter((event) => event.actorType === "system").length,
      admin: events.filter((event) => event.actorType === "admin").length,
      provider: events.filter((event) => event.actorType === "provider").length,
      family: events.filter((event) => event.actorType === "family").length,
      partner: events.filter((event) => event.actorType === "partner").length
    },
    events,
    nextActions: events.length
      ? ["Use audit events to trace policy, claim, import, and publishing actions before launch approvals."]
      : ["No audit events exist in the current result window."]
  };
}

export async function exportAuditEvents(
  input: {
    eventType?: string;
    subjectType?: string;
    actorType?: string;
    createdBefore?: string;
    retentionDays?: number;
    format?: AuditEventExportFormat;
    limit?: number;
  } = {}
): Promise<AuditEventExportResult> {
  const format = input.format ?? "json";
  const { retentionDays, retentionCutoff } = retentionCutoffFor(input.retentionDays);
  const summary = await listAuditEvents({
    eventType: input.eventType,
    subjectType: input.subjectType,
    actorType: input.actorType,
    createdBefore: input.createdBefore,
    limit: input.limit ?? 250
  });
  const retentionCandidates = summary.events.filter((event) => Date.parse(event.createdAt) < Date.parse(retentionCutoff));
  const result: AuditEventExportResult = {
    generatedAt: new Date().toISOString(),
    source: summary.source,
    format,
    retentionDays,
    retentionCutoff,
    totals: {
      events: summary.events.length,
      retained: summary.events.length - retentionCandidates.length,
      retentionCandidates: retentionCandidates.length
    },
    events: summary.events,
    nextActions: [
      ...(retentionCandidates.length
        ? ["Review retention candidates before any owner-approved purge workflow is enabled."]
        : []),
      ...(summary.events.length ? ["Archive this export with launch approval evidence and compliance review notes."] : []),
      ...(!summary.events.length ? ["No audit events matched the export filters."] : [])
    ]
  };

  if (format === "csv") {
    result.csv = auditEventsToCsv(summary.events);
  }

  return result;
}

export async function getAuditRetentionControls(
  input: { retentionDays?: number; dryRun?: boolean; limit?: number } = {}
): Promise<AuditRetentionControlResult> {
  const dryRun = input.dryRun ?? true;
  const { retentionDays, retentionCutoff } = retentionCutoffFor(input.retentionDays);
  const summary = await listAuditEvents({ createdBefore: retentionCutoff, limit: input.limit ?? 250 });
  const blockers = [
    ...(!dryRun ? ["Live audit purge is disabled until the owner approves retention policy, legal hold rules, and export archive storage."] : [])
  ];

  return {
    generatedAt: new Date().toISOString(),
    source: summary.source,
    dryRun,
    retentionDays,
    retentionCutoff,
    status: blockers.length ? "blocked" : "preview",
    totals: {
      scanned: summary.events.length,
      retained: 0,
      retentionCandidates: summary.events.length
    },
    retentionCandidates: summary.events,
    blockers,
    nextActions: [
      ...(summary.events.length
        ? ["Export retention candidates and collect owner/legal signoff before enabling purge execution."]
        : ["No audit events are older than the current retention cutoff in the scanned window."]),
      ...(!dryRun ? ["Keep live purge disabled and park owner approval in the retention parking-lot note."] : [])
    ]
  };
}
