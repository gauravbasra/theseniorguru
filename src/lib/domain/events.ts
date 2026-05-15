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

export type EventAttendanceDecision = "attended" | "no_show";

export type EventAttendanceInput = {
  eventId: string;
  rsvpId: string;
  status: EventAttendanceDecision;
  checkedInAt?: string;
  attendanceSource?: string;
  notes?: string;
  actorId?: string;
};

export type EventAttendanceRecord = {
  id: string;
  eventId: string;
  rsvpId: string;
  status: EventAttendanceDecision;
  checkedInAt?: string;
  attendanceSource: string;
  notes?: string;
  actorId?: string;
  createdAt: string;
  rsvp: EventRsvpRecord;
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

export type EventReminderStatus = "queued" | "sent" | "blocked";

export type EventReminderRecord = {
  id: string;
  eventId: string;
  rsvpId: string;
  reminderType: "event_reminder_48h";
  status: EventReminderStatus;
  scheduledFor: string;
  recipientEmail: string;
  deliveryProvider?: string;
  deliveryPayload: Record<string, unknown>;
  sentAt?: string;
  createdAt: string;
};

export type EventFollowupRecord = {
  id: string;
  eventId: string;
  rsvpId: string;
  followupType: "post_event_review";
  status: EventReminderStatus;
  scheduledFor: string;
  recipientEmail: string;
  deliveryProvider?: string;
  deliveryPayload: Record<string, unknown>;
  sentAt?: string;
  createdAt: string;
};

export type EventAutomationRunInput = {
  now?: string;
  reminderWindowHours?: number;
  followupWindowHours?: number;
  deliveryProvider?: string;
  actorId?: string;
  dryRun?: boolean;
};

export type EventAutomationRunSummary = {
  dryRun: boolean;
  reminderWindowHours: number;
  followupWindowHours: number;
  scannedEvents: number;
  scannedRsvps: number;
  remindersQueued: number;
  followupsQueued: number;
  skippedExisting: number;
  deliveryProvider: string;
  ranAt: string;
  reminders: EventReminderRecord[];
  followups: EventFollowupRecord[];
};

export type EventAutomationDeliveryProvider = "manual_export" | "internal_notification_queue";

export type EventAutomationDeliveryInput = {
  eventId?: string;
  dryRun?: boolean;
  deliveryProvider?: EventAutomationDeliveryProvider;
  actorId?: string;
  limit?: number;
};

export type EventAutomationDeliveryResult = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  dryRun: boolean;
  deliveryProvider: EventAutomationDeliveryProvider;
  totals: {
    scanned: number;
    sent: number;
    blocked: number;
    reminders: number;
    followups: number;
  };
  deliveries: Array<{
    id: string;
    eventId: string;
    rsvpId: string;
    type: "event_reminder_48h" | "post_event_review";
    recipientEmail: string;
    status: EventReminderStatus;
    deliveryPayload: Record<string, unknown>;
  }>;
  nextActions: string[];
};

export type EventFollowupComposerInput = {
  eventId: string;
  tone?: "warm" | "professional" | "concise";
  callToAction?: "review" | "schedule_tour" | "ask_question";
  actorId?: string;
};

export type EventFollowupComposerResult = {
  eventId: string;
  generatedAt: string;
  source: "supabase" | "local_fallback";
  tone: "warm" | "professional" | "concise";
  callToAction: "review" | "schedule_tour" | "ask_question";
  audience: {
    confirmed: number;
    attended: number;
    noShow: number;
    followupEligible: number;
  };
  subject: string;
  body: string;
  mergeFields: Record<string, string>;
  recommendedSegments: string[];
  auditEventId?: string;
  nextActions: string[];
};

export type EventAutomationReport = {
  eventId: string;
  generatedAt: string;
  reminders: {
    total: number;
    queued: number;
    sent: number;
    blocked: number;
    records: EventReminderRecord[];
  };
  followups: {
    total: number;
    queued: number;
    sent: number;
    blocked: number;
    records: EventFollowupRecord[];
  };
  attendanceSegments: {
    confirmed: number;
    attended: number;
    noShow: number;
    followupEligible: number;
  };
  nextActions: string[];
};
