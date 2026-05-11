export type ProviderOutreachStatus =
  | "queued"
  | "sent"
  | "opened"
  | "clicked"
  | "claimed"
  | "bounced"
  | "unsubscribed"
  | "blocked";

export type ProviderOutreachChannel = "email" | "phone" | "sms" | "mail" | "manual";

export type ProviderOutreachRecord = {
  id: string;
  providerId: string;
  sequenceKey: string;
  status: ProviderOutreachStatus;
  channel: ProviderOutreachChannel;
  recipient?: string;
  subject?: string;
  body?: string;
  policyCheckId?: string;
  scheduledFor?: string;
  sentAt?: string;
  createdAt: string;
};

export type CreateProviderOutreachInput = {
  providerId: string;
  sequenceKey?: string;
  channel?: ProviderOutreachChannel;
  recipient?: string;
  subject?: string;
  body?: string;
  scheduledFor?: string;
};

export type SendProviderOutreachInput = {
  outreachId: string;
  actorId?: string;
  deliveryProvider?: "mailjet" | "google" | "manual" | "pending";
  deliveryId?: string;
};

export type RequeueProviderOutreachInput = {
  outreachId: string;
  actorId?: string;
  reason?: string;
};

export type RequeueProviderOutreachResult = {
  outreach: ProviderOutreachRecord;
  previousStatus: ProviderOutreachStatus;
  status: "queued";
};
