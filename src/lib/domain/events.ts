export type EventStatus = "draft" | "published" | "featured" | "canceled" | "completed" | "blocked_by_policy";

export type EventRecord = {
  id: string;
  providerId?: string;
  title: string;
  slug: string;
  description?: string;
  eventType: string;
  status: EventStatus;
  startsAt: string;
  endsAt: string;
  timezone: string;
  venueName?: string;
  city?: string;
  state?: string;
  capacity?: number;
  isFree: boolean;
  registrationUrl?: string;
};

export type CreateEventInput = {
  providerId?: string;
  title: string;
  description?: string;
  eventType: string;
  startsAt: string;
  endsAt: string;
  timezone?: string;
  venueName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  capacity?: number;
  isFree?: boolean;
  registrationUrl?: string;
  publish?: boolean;
};

export type EventRsvpInput = {
  eventId: string;
  attendeeName: string;
  attendeeEmail: string;
  attendeePhone?: string;
  partySize?: number;
  consentPayload?: Record<string, unknown>;
};

export type EventRsvpRecord = EventRsvpInput & {
  id: string;
  status: "confirmed" | "waitlisted" | "canceled" | "attended" | "no_show";
  createdAt: string;
};

