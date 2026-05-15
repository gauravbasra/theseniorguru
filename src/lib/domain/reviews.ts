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

export type ReviewModerationStatus = "published" | "hidden" | "removed";

export type ReviewModerationInput = {
  reviewId: string;
  status: ReviewModerationStatus;
  reason: string;
  actorId?: string;
  notes?: string;
};

export type ReviewModerationRecord = {
  id: string;
  reviewId: string;
  providerId: string;
  previousStatus: ReviewRecord["status"];
  newStatus: ReviewRecord["status"];
  reason: string;
  notes?: string;
  actorId?: string;
  policyDecision: string;
  createdAt: string;
};

export type ReviewSentimentRecord = {
  id: string;
  reviewId: string;
  providerId: string;
  sentiment: "positive" | "neutral" | "negative";
  score: number;
  themes: string[];
  summary: string;
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

export type ReviewResponseRecord = {
  id: string;
  reviewId: string;
  providerId?: string;
  body: string;
  status: "draft" | "approved" | "published" | "blocked";
  generatedByAi: boolean;
  policyDecision?: string;
  createdAt: string;
  publishedAt?: string;
};

export type PublishReviewResponseInput = {
  reviewId: string;
  providerId: string;
  body: string;
  generatedByAi?: boolean;
  actorId?: string;
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
  deliveryProvider?: string;
  deliveryPayload?: Record<string, unknown>;
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

export type SendReviewRequestCampaignInput = {
  campaignId: string;
  actorId?: string;
  limit?: number;
  dryRun?: boolean;
  deliveryProvider?: "internal_notification_queue" | "manual_export" | "mailjet" | "google" | "manual" | "pending";
};

export type SendReviewRequestCampaignResult = {
  campaignId: string;
  status: ReviewRequestCampaignStatus;
  processed: number;
  sent: number;
  failed: number;
  blocked: number;
  dryRun: boolean;
  deliveryProvider: string;
  requests: ReviewRequestRecord[];
  deliveryAttempts: Array<{
    requestId: string;
    status: ReviewRequestRecord["status"];
    provider: string;
    target?: string;
    payload: Record<string, unknown>;
  }>;
};

export type ReputationReadinessSummary = {
  generatedAt: string;
  providerId: string;
  status: "ready" | "action_required" | "blocked";
  reviewSummary: {
    publishedReviews: number;
    averageRating?: number;
    pendingModeration: number;
    blockedByPolicy: number;
    sentiment: {
      positive: number;
      neutral: number;
      negative: number;
      averageScore?: number;
    };
  };
  campaignSummary: {
    campaigns: number;
    queuedCampaigns: number;
    blockedCampaigns: number;
    queuedRequests: number;
    blockedRequests: number;
  };
  blockers: string[];
  nextActions: string[];
};
