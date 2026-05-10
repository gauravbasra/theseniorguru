export type ReviewRecord = {
  id: string;
  providerId: string;
  reviewerName: string;
  reviewerEmail?: string;
  rating: number;
  title?: string;
  body?: string;
  status: "pending_moderation" | "published" | "hidden" | "removed" | "blocked_by_policy";
  source: string;
  createdAt: string;
};

export type CreateReviewInput = {
  providerId: string;
  reviewerName: string;
  reviewerEmail?: string;
  rating: number;
  title?: string;
  body?: string;
};

export type ReviewResponseDraft = {
  reviewId: string;
  body: string;
  generatedByAi: boolean;
  policyDecision: string;
};

export type ReviewRequestCampaignStatus = "draft" | "queued" | "sent" | "blocked_by_policy" | "completed_with_errors";

export type ReviewRequestRecipientInput = {
  name?: string;
  email: string;
  consentPayload: Record<string, unknown>;
};

export type ReviewRequestCampaignInput = {
  providerId: string;
  name: string;
  message?: string;
  channel?: "email" | "sms" | "manual";
  recipients: ReviewRequestRecipientInput[];
  actorId?: string;
};

export type ReviewRequestRecord = {
  id: string;
  providerId: string;
  campaignId?: string;
  recipientName?: string;
  recipientEmail?: string;
  channel: string;
  status: "queued" | "sent" | "blocked_by_policy" | "failed";
  consentPayload: Record<string, unknown>;
  sentAt?: string;
  createdAt: string;
};

export type ReviewRequestCampaignRecord = {
  id: string;
  providerId: string;
  name: string;
  message?: string;
  channel: string;
  status: ReviewRequestCampaignStatus;
  totalRecipients: number;
  queuedRequests: number;
  blockedRequests: number;
  policyDecision: string;
  createdAt: string;
};
