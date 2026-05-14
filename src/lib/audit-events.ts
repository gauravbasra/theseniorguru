import crypto from "node:crypto";
import type { AuditEventSummary, OperationalAuditEvent, RecordAuditEventInput } from "@/lib/domain/audit";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const localAuditEvents: OperationalAuditEvent[] = [];

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
      actor_id: input.actorId,
      actor_type: input.actorType ?? "system",
      event_type: input.eventType,
      subject_type: input.subjectType,
      subject_id: input.subjectId,
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
  input: { eventType?: string; subjectType?: string; actorType?: string; limit?: number } = {}
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
