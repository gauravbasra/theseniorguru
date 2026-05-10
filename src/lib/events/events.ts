import type { CreateEventInput, EventRecord, EventRsvpInput, EventRsvpRecord } from "@/lib/domain/events";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedEvents: EventRecord[] = [
  {
    id: "seed-denver-caregiver-workshop",
    providerId: "seed-cottages-dayton-place",
    title: "Denver Caregiver Planning Workshop",
    slug: "denver-caregiver-planning-workshop",
    description: "A free local workshop for families comparing care options and planning next steps.",
    eventType: "workshop",
    status: "published",
    startsAt: "2026-06-15T16:00:00.000Z",
    endsAt: "2026-06-15T17:30:00.000Z",
    timezone: "America/Denver",
    venueName: "Denver Community Resource Center",
    city: "Denver",
    state: "CO",
    capacity: 40,
    isFree: true,
    registrationUrl: "https://example.com/events/denver-caregiver-workshop"
  }
];
const seedRsvps: EventRsvpRecord[] = [];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function mapEvent(row: Record<string, unknown>): EventRecord {
  return {
    id: String(row.id),
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    title: String(row.title),
    slug: String(row.slug),
    description: row.description ? String(row.description) : undefined,
    eventType: String(row.event_type),
    status: row.status as EventRecord["status"],
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    timezone: String(row.timezone),
    venueName: row.venue_name ? String(row.venue_name) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    capacity: row.capacity ? Number(row.capacity) : undefined,
    isFree: Boolean(row.is_free),
    registrationUrl: row.registration_url ? String(row.registration_url) : undefined
  };
}

export async function listEvents(): Promise<EventRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedEvents;
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .in("status", ["published", "featured"])
    .order("starts_at", { ascending: true })
    .limit(50);

  if (error) {
    throw new Error(`Event query failed: ${error.message}`);
  }

  return (data ?? []).map(mapEvent);
}

export async function getEventById(id: string) {
  const events = await listEvents();
  return events.find((event) => event.id === id || event.slug === id) ?? null;
}

export async function createEvent(input: CreateEventInput): Promise<EventRecord> {
  const policy = await runPolicyCheck({
    subjectType: "event",
    actionKey: input.publish ? "publish_event" : "create_event",
    input
  });

  const status = policy.decision.startsWith("blocked") ? "blocked_by_policy" : input.publish ? "published" : "draft";
  const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-event-${Date.now()}`,
      providerId: input.providerId,
      title: input.title,
      slug,
      description: input.description,
      eventType: input.eventType,
      status,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      timezone: input.timezone ?? "America/Denver",
      venueName: input.venueName,
      city: input.city,
      state: input.state,
      capacity: input.capacity,
      isFree: input.isFree ?? true,
      registrationUrl: input.registrationUrl
    };
  }

  const { data, error } = await supabase
    .from("events")
    .insert({
      provider_id: input.providerId,
      title: input.title,
      slug,
      description: input.description,
      event_type: input.eventType,
      status,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      timezone: input.timezone ?? "America/Denver",
      venue_name: input.venueName,
      address_line1: input.addressLine1,
      city: input.city,
      state: input.state,
      postal_code: input.postalCode,
      capacity: input.capacity,
      is_free: input.isFree ?? true,
      registration_url: input.registrationUrl
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Event creation failed: ${error.message}`);
  }

  return mapEvent(data);
}

export async function createEventRsvp(input: EventRsvpInput): Promise<EventRsvpRecord> {
  const event = await getEventById(input.eventId);

  if (!event) {
    throw new Error("Event not found");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-rsvp-${Date.now()}`,
      ...input,
      partySize: input.partySize ?? 1,
      status: "confirmed",
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("event_rsvps")
    .insert({
      event_id: input.eventId,
      attendee_name: input.attendeeName,
      attendee_email: input.attendeeEmail,
      attendee_phone: input.attendeePhone,
      party_size: input.partySize ?? 1,
      consent_payload: input.consentPayload ?? {}
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Event RSVP failed: ${error.message}`);
  }

  return {
    id: data.id,
    eventId: data.event_id,
    attendeeName: data.attendee_name,
    attendeeEmail: data.attendee_email,
    attendeePhone: data.attendee_phone ?? undefined,
    partySize: data.party_size,
    status: data.status,
    consentPayload: data.consent_payload ?? {},
    createdAt: data.created_at
  };
}
