import crypto from "node:crypto";
import type {
  EventAutomationReport,
  EventAutomationRunInput,
  EventAutomationRunSummary,
  EventFollowupRecord,
  EventRecord,
  EventReminderRecord,
  EventRsvpRecord
} from "@/lib/domain/events";
import { listEvents, listEventRsvps } from "@/lib/events/events";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const fallbackReminders: EventReminderRecord[] = [];
const fallbackFollowups: EventFollowupRecord[] = [];

function normalizeHours(value: number | undefined, fallback: number) {
  if (!value || Number.isNaN(value)) return fallback;
  return Math.max(1, Math.min(Math.floor(value), 168));
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function mapReminder(row: Record<string, unknown>): EventReminderRecord {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    rsvpId: String(row.rsvp_id),
    reminderType: row.reminder_type as EventReminderRecord["reminderType"],
    status: row.status as EventReminderRecord["status"],
    scheduledFor: String(row.scheduled_for),
    recipientEmail: String(row.recipient_email),
    deliveryProvider: row.delivery_provider ? String(row.delivery_provider) : undefined,
    deliveryPayload: row.delivery_payload && typeof row.delivery_payload === "object"
      ? (row.delivery_payload as Record<string, unknown>)
      : {},
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function mapFollowup(row: Record<string, unknown>): EventFollowupRecord {
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    rsvpId: String(row.rsvp_id),
    followupType: row.followup_type as EventFollowupRecord["followupType"],
    status: row.status as EventFollowupRecord["status"],
    scheduledFor: String(row.scheduled_for),
    recipientEmail: String(row.recipient_email),
    deliveryProvider: row.delivery_provider ? String(row.delivery_provider) : undefined,
    deliveryPayload: row.delivery_payload && typeof row.delivery_payload === "object"
      ? (row.delivery_payload as Record<string, unknown>)
      : {},
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function summarizeStatuses(records: Array<{ status: string }>) {
  return records.reduce(
    (summary, record) => {
      summary.total += 1;
      if (record.status === "queued") summary.queued += 1;
      if (record.status === "sent") summary.sent += 1;
      if (record.status === "blocked") summary.blocked += 1;
      return summary;
    },
    { total: 0, queued: 0, sent: 0, blocked: 0 }
  );
}

function buildAutomationNextActions(input: {
  confirmed: number;
  attended: number;
  remindersQueued: number;
  followupsQueued: number;
  followupEligible: number;
}) {
  const actions: string[] = [];

  if (input.confirmed > 0 && input.remindersQueued === 0) {
    actions.push("Run reminder automation before the event so confirmed families receive a manual-delivery reminder.");
  }

  if (input.attended > 0 && input.followupsQueued === 0) {
    actions.push("Run follow-up automation for attended families to request reviews or next-step questions.");
  }

  if (input.followupEligible > input.followupsQueued) {
    actions.push("Review attendance and no-show segmentation before sending post-event follow-ups.");
  }

  if (!actions.length) {
    actions.push("Automation coverage is current for the event records available to the platform.");
  }

  return actions;
}

function reminderPayload(event: EventRecord, rsvp: EventRsvpRecord) {
  return {
    eventTitle: event.title,
    eventStartsAt: event.startsAt,
    eventTimezone: event.timezone,
    attendeeName: rsvp.attendeeName,
    partySize: rsvp.partySize ?? 1,
    venueName: event.venueName,
    city: event.city,
    state: event.state
  };
}

function followupPayload(event: EventRecord, rsvp: EventRsvpRecord) {
  return {
    eventTitle: event.title,
    eventEndedAt: event.endsAt,
    attendeeName: rsvp.attendeeName,
    partySize: rsvp.partySize ?? 1,
    requestedAction: "share_review_or_question"
  };
}

async function listRsvpsForEvents(events: EventRecord[]) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const grouped = await Promise.all(events.map((event) => listEventRsvps(event.id)));
    return grouped.flat();
  }

  const eventIds = events.map((event) => event.id);

  if (!eventIds.length) return [];

  const { data, error } = await supabase
    .from("event_rsvps")
    .select("*")
    .in("event_id", eventIds)
    .in("status", ["confirmed", "attended"]);

  if (error) {
    throw new Error(`Event automation RSVP query failed: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    attendeeName: row.attendee_name,
    attendeeEmail: row.attendee_email,
    attendeePhone: row.attendee_phone ?? undefined,
    partySize: row.party_size,
    status: row.status,
    consentPayload: row.consent_payload ?? {},
    createdAt: row.created_at
  })) as EventRsvpRecord[];
}

async function writeAutomationAudit(input: {
  eventType: string;
  actorId?: string;
  summary: Record<string, unknown>;
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) return;

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    event_type: input.eventType,
    subject_type: "event_automation",
    metadata: input.summary
  });
}

async function runFallbackEventAutomation(input: {
  now: Date;
  reminderWindowHours: number;
  followupWindowHours: number;
  deliveryProvider: string;
  actorId?: string;
}): Promise<EventAutomationRunSummary> {
  const events = await listEvents();
  const reminderCutoff = addHours(input.now, input.reminderWindowHours);
  const followupCutoff = addHours(input.now, -input.followupWindowHours);
  const reminderEvents = events.filter((event) => {
    const startsAt = Date.parse(event.startsAt);
    return startsAt > input.now.getTime() && startsAt <= reminderCutoff.getTime();
  });
  const followupEvents = events.filter((event) => {
    const endsAt = Date.parse(event.endsAt);
    return endsAt <= input.now.getTime() && endsAt >= followupCutoff.getTime();
  });
  const candidateEvents = [...reminderEvents, ...followupEvents].filter(
    (event, index, all) => all.findIndex((item) => item.id === event.id) === index
  );
  const rsvps = await listRsvpsForEvents(candidateEvents);
  let skippedExisting = 0;
  const queuedReminders: EventReminderRecord[] = [];
  const queuedFollowups: EventFollowupRecord[] = [];

  for (const event of reminderEvents) {
    for (const rsvp of rsvps.filter((item) => item.eventId === event.id && item.status === "confirmed")) {
      const exists = fallbackReminders.some((item) => item.eventId === event.id && item.rsvpId === rsvp.id);

      if (exists) {
        skippedExisting += 1;
        continue;
      }

      const record: EventReminderRecord = {
        id: `event-reminder-${crypto.randomUUID()}`,
        eventId: event.id,
        rsvpId: rsvp.id,
        reminderType: "event_reminder_48h",
        status: "queued",
        scheduledFor: input.now.toISOString(),
        recipientEmail: rsvp.attendeeEmail,
        deliveryProvider: input.deliveryProvider,
        deliveryPayload: reminderPayload(event, rsvp),
        createdAt: input.now.toISOString()
      };
      fallbackReminders.unshift(record);
      queuedReminders.push(record);
    }
  }

  for (const event of followupEvents) {
    for (const rsvp of rsvps.filter((item) => item.eventId === event.id && ["confirmed", "attended"].includes(item.status))) {
      const exists = fallbackFollowups.some((item) => item.eventId === event.id && item.rsvpId === rsvp.id);

      if (exists) {
        skippedExisting += 1;
        continue;
      }

      const record: EventFollowupRecord = {
        id: `event-followup-${crypto.randomUUID()}`,
        eventId: event.id,
        rsvpId: rsvp.id,
        followupType: "post_event_review",
        status: "queued",
        scheduledFor: input.now.toISOString(),
        recipientEmail: rsvp.attendeeEmail,
        deliveryProvider: input.deliveryProvider,
        deliveryPayload: followupPayload(event, rsvp),
        createdAt: input.now.toISOString()
      };
      fallbackFollowups.unshift(record);
      queuedFollowups.push(record);
    }
  }

  const summary = {
    reminderWindowHours: input.reminderWindowHours,
    followupWindowHours: input.followupWindowHours,
    scannedEvents: candidateEvents.length,
    scannedRsvps: rsvps.length,
    remindersQueued: queuedReminders.length,
    followupsQueued: queuedFollowups.length,
    skippedExisting,
    deliveryProvider: input.deliveryProvider,
    ranAt: input.now.toISOString(),
    reminders: queuedReminders,
    followups: queuedFollowups
  };

  await writeAutomationAudit({
    actorId: input.actorId,
    eventType: "event_automation.fallback_run",
    summary
  });

  return summary;
}

export async function runEventReminderAutomation(input: EventAutomationRunInput = {}): Promise<EventAutomationRunSummary> {
  const now = input.now ? new Date(input.now) : new Date();

  if (Number.isNaN(now.getTime())) {
    throw new Error("now must be a valid ISO timestamp");
  }

  const reminderWindowHours = normalizeHours(input.reminderWindowHours, 48);
  const followupWindowHours = normalizeHours(input.followupWindowHours, 48);
  const deliveryProvider = input.deliveryProvider ?? "internal_notification_queue";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return runFallbackEventAutomation({
      now,
      reminderWindowHours,
      followupWindowHours,
      deliveryProvider,
      actorId: input.actorId
    });
  }

  const reminderCutoff = addHours(now, reminderWindowHours).toISOString();
  const followupCutoff = addHours(now, -followupWindowHours).toISOString();
  const { data: reminderRows, error: reminderError } = await supabase
    .from("events")
    .select("*")
    .in("status", ["published", "featured"])
    .gt("starts_at", now.toISOString())
    .lte("starts_at", reminderCutoff)
    .order("starts_at", { ascending: true })
    .limit(100);

  if (reminderError) {
    throw new Error(`Event reminder candidate query failed: ${reminderError.message}`);
  }

  const { data: followupRows, error: followupError } = await supabase
    .from("events")
    .select("*")
    .in("status", ["published", "featured"])
    .lte("ends_at", now.toISOString())
    .gte("ends_at", followupCutoff)
    .order("ends_at", { ascending: false })
    .limit(100);

  if (followupError) {
    throw new Error(`Event follow-up candidate query failed: ${followupError.message}`);
  }

  const reminderEvents = (reminderRows ?? []).map((row) => ({
    id: row.id,
    providerId: row.provider_id ?? undefined,
    title: row.title,
    slug: row.slug,
    description: row.description ?? undefined,
    eventType: row.event_type,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    venueName: row.venue_name ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    capacity: row.capacity ?? undefined,
    isFree: row.is_free,
    registrationUrl: row.registration_url ?? undefined
  })) as EventRecord[];
  const followupEvents = (followupRows ?? []).map((row) => ({
    id: row.id,
    providerId: row.provider_id ?? undefined,
    title: row.title,
    slug: row.slug,
    description: row.description ?? undefined,
    eventType: row.event_type,
    status: row.status,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    venueName: row.venue_name ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    capacity: row.capacity ?? undefined,
    isFree: row.is_free,
    registrationUrl: row.registration_url ?? undefined
  })) as EventRecord[];
  const candidateEvents = [...reminderEvents, ...followupEvents].filter(
    (event, index, all) => all.findIndex((item) => item.id === event.id) === index
  );
  const rsvps = await listRsvpsForEvents(candidateEvents);
  const eventIds = candidateEvents.map((event) => event.id);
  const [existingReminders, existingFollowups] = await Promise.all([
    eventIds.length
      ? supabase.from("event_reminders").select("event_id,rsvp_id,reminder_type").in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null }),
    eventIds.length
      ? supabase.from("event_followups").select("event_id,rsvp_id,followup_type").in("event_id", eventIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (existingReminders.error) {
    throw new Error(`Event reminder idempotency query failed: ${existingReminders.error.message}`);
  }

  if (existingFollowups.error) {
    throw new Error(`Event follow-up idempotency query failed: ${existingFollowups.error.message}`);
  }

  const reminderKeys = new Set((existingReminders.data ?? []).map((row) => `${row.event_id}:${row.rsvp_id}:${row.reminder_type}`));
  const followupKeys = new Set((existingFollowups.data ?? []).map((row) => `${row.event_id}:${row.rsvp_id}:${row.followup_type}`));
  let skippedExisting = 0;
  const reminderInserts = [];
  const followupInserts = [];

  for (const event of reminderEvents) {
    for (const rsvp of rsvps.filter((item) => item.eventId === event.id && item.status === "confirmed")) {
      const key = `${event.id}:${rsvp.id}:event_reminder_48h`;

      if (reminderKeys.has(key)) {
        skippedExisting += 1;
        continue;
      }

      reminderInserts.push({
        event_id: event.id,
        rsvp_id: rsvp.id,
        reminder_type: "event_reminder_48h",
        status: "queued",
        scheduled_for: now.toISOString(),
        recipient_email: rsvp.attendeeEmail,
        delivery_provider: deliveryProvider,
        delivery_payload: reminderPayload(event, rsvp)
      });
      reminderKeys.add(key);
    }
  }

  for (const event of followupEvents) {
    for (const rsvp of rsvps.filter((item) => item.eventId === event.id && ["confirmed", "attended"].includes(item.status))) {
      const key = `${event.id}:${rsvp.id}:post_event_review`;

      if (followupKeys.has(key)) {
        skippedExisting += 1;
        continue;
      }

      followupInserts.push({
        event_id: event.id,
        rsvp_id: rsvp.id,
        followup_type: "post_event_review",
        status: "queued",
        scheduled_for: now.toISOString(),
        recipient_email: rsvp.attendeeEmail,
        delivery_provider: deliveryProvider,
        delivery_payload: followupPayload(event, rsvp)
      });
      followupKeys.add(key);
    }
  }

  const [insertedReminders, insertedFollowups] = await Promise.all([
    reminderInserts.length
      ? supabase.from("event_reminders").insert(reminderInserts).select("*")
      : Promise.resolve({ data: [], error: null }),
    followupInserts.length
      ? supabase.from("event_followups").insert(followupInserts).select("*")
      : Promise.resolve({ data: [], error: null })
  ]);

  if (insertedReminders.error) {
    throw new Error(`Event reminder queue insert failed: ${insertedReminders.error.message}`);
  }

  if (insertedFollowups.error) {
    throw new Error(`Event follow-up queue insert failed: ${insertedFollowups.error.message}`);
  }

  const summary: EventAutomationRunSummary = {
    reminderWindowHours,
    followupWindowHours,
    scannedEvents: candidateEvents.length,
    scannedRsvps: rsvps.length,
    remindersQueued: insertedReminders.data?.length ?? 0,
    followupsQueued: insertedFollowups.data?.length ?? 0,
    skippedExisting,
    deliveryProvider,
    ranAt: now.toISOString(),
    reminders: (insertedReminders.data ?? []).map(mapReminder),
    followups: (insertedFollowups.data ?? []).map(mapFollowup)
  };

  await writeAutomationAudit({
    actorId: input.actorId,
    eventType: "event_automation.queued",
    summary
  });

  return summary;
}

export async function getEventAutomationReport(eventId: string): Promise<EventAutomationReport> {
  const event = (await listEvents()).find((item) => item.id === eventId || item.slug === eventId);

  if (!event) {
    throw new Error("Event not found");
  }

  const supabase = getSupabaseAdminClient();
  const rsvps = await listEventRsvps(event.id);
  const reminders = supabase
    ? await supabase
        .from("event_reminders")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) throw new Error(`Event reminder report query failed: ${error.message}`);
          return (data ?? []).map(mapReminder);
        })
    : fallbackReminders.filter((reminder) => reminder.eventId === event.id);
  const followups = supabase
    ? await supabase
        .from("event_followups")
        .select("*")
        .eq("event_id", event.id)
        .order("created_at", { ascending: false })
        .then(({ data, error }) => {
          if (error) throw new Error(`Event follow-up report query failed: ${error.message}`);
          return (data ?? []).map(mapFollowup);
        })
    : fallbackFollowups.filter((followup) => followup.eventId === event.id);
  const reminderStatus = summarizeStatuses(reminders);
  const followupStatus = summarizeStatuses(followups);
  const attendanceSegments = rsvps.reduce(
    (summary, rsvp) => {
      const partySize = rsvp.partySize ?? 1;
      if (rsvp.status === "confirmed") summary.confirmed += partySize;
      if (rsvp.status === "attended") summary.attended += partySize;
      if (rsvp.status === "no_show") summary.noShow += partySize;
      if (["confirmed", "attended"].includes(rsvp.status)) summary.followupEligible += partySize;
      return summary;
    },
    { confirmed: 0, attended: 0, noShow: 0, followupEligible: 0 }
  );

  return {
    eventId: event.id,
    generatedAt: new Date().toISOString(),
    reminders: {
      ...reminderStatus,
      records: reminders
    },
    followups: {
      ...followupStatus,
      records: followups
    },
    attendanceSegments,
    nextActions: buildAutomationNextActions({
      confirmed: attendanceSegments.confirmed,
      attended: attendanceSegments.attended,
      remindersQueued: reminderStatus.queued + reminderStatus.sent,
      followupsQueued: followupStatus.queued + followupStatus.sent,
      followupEligible: attendanceSegments.followupEligible
    })
  };
}
