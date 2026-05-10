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

export type EventPromotionStatus = "draft" | "pending_policy" | "active" | "paused" | "completed" | "blocked";

export type EventPromotionRecord = {
  id: string;
  eventId: string;
  status: EventPromotionStatus;
  placementKey: string;
  budgetCents: number;
  startsAt?: string;
  endsAt?: string;
  disclosureLabel: string;
  policyCheckId?: string;
  createdAt: string;
};

export type CreateEventPromotionInput = {
  eventId: string;
  placementKey?: string;
  budgetCents?: number;
  startsAt?: string;
  endsAt?: string;
  disclosureLabel?: string;
  activate?: boolean;
  actorId?: string;
};

export type ActivateEventPromotionInput = {
  promotionId: string;
  actorId?: string;
};

export type EventAnalyticsSummary = {
  eventId: string;
  rsvps: {
    total: number;
    confirmed: number;
    waitlisted: number;
    canceled: number;
    attended: number;
    noShow: number;
  };
  promotions: {
    total: number;
    active: number;
    budgetCents: number;
  };
  ads: {
    impressions: number;
    clicks: number;
    clickThroughRate: number;
  };
  generatedAt: string;
};
