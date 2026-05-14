export type ApiClientScope =
  | "providers:read"
  | "events:read"
  | "reviews:read"
  | "campaigns:read"
  | "ads:read"
  | "usage:read"
  | "claims:write"
  | "webhooks:write";

export type ApiClientRecord = {
  id: string;
  name: string;
  ownerType: "provider" | "partner" | "admin";
  ownerId?: string;
  scopes: ApiClientScope[];
  sandboxMode: boolean;
  rateLimitPerMinute: number;
  status: "active" | "paused" | "revoked";
  createdAt: string;
};

export type CreateApiClientInput = {
  name: string;
  ownerType?: ApiClientRecord["ownerType"];
  ownerId?: string;
  scopes?: ApiClientScope[];
  sandboxMode?: boolean;
  rateLimitPerMinute?: number;
};

export type ApiKeyRecord = {
  id: string;
  apiClientId: string;
  name: string;
  keyPreview: string;
  status: "active" | "revoked";
  createdAt: string;
  expiresAt?: string;
  lastUsedAt?: string;
};

export type CreateApiKeyInput = {
  apiClientId: string;
  name: string;
  expiresAt?: string;
};

export type CreatedApiKeyRecord = ApiKeyRecord & {
  secret: string;
};

export type WebhookEventType =
  | "provider.claimed"
  | "provider.updated"
  | "provider.contact.created"
  | "review.created"
  | "review.response.published"
  | "event.created"
  | "event.rsvp.created"
  | "campaign.published"
  | "campaign.metric.updated"
  | "ad.impression.recorded"
  | "ad.click.recorded"
  | "community.post.created";

export type WebhookSubscriptionRecord = {
  id: string;
  apiClientId: string;
  targetUrl: string;
  eventTypes: WebhookEventType[];
  signingSecretPreview: string;
  status: "active" | "paused" | "revoked";
  createdAt: string;
};

export type CreateWebhookSubscriptionInput = {
  apiClientId: string;
  targetUrl: string;
  eventTypes: WebhookEventType[];
};

export type CreatedWebhookSubscriptionRecord = WebhookSubscriptionRecord & {
  signingSecret: string;
};

export type WebhookSignatureVerificationInput = {
  apiClientId: string;
  subscriptionId: string;
  signature: string;
  payload: string;
  timestamp?: number;
  toleranceSeconds?: number;
};

export type WebhookSignatureVerificationResult = {
  valid: boolean;
  subscriptionId: string;
  apiClientId: string;
  signaturePreview?: string;
  timestamp: number;
  timestampSkewSeconds: number;
  toleranceSeconds: number;
  eventTypes: WebhookEventType[];
  reasons: string[];
};

export type WebhookDeliveryRecord = {
  id: string;
  subscriptionId: string;
  eventType: WebhookEventType;
  subjectId?: string;
  payload: Record<string, unknown>;
  status: "queued" | "delivered" | "failed" | "blocked";
  attempts: number;
  lastError?: string;
  createdAt: string;
  deliveredAt?: string;
};

export type EnqueueWebhookDeliveryInput = {
  eventType: WebhookEventType;
  subjectId?: string;
  payload: Record<string, unknown>;
};

export type ApiAuditEventRecord = {
  id: string;
  apiClientId?: string;
  eventType: string;
  subjectType?: string;
  subjectId?: string;
  status: "allowed" | "blocked" | "rate_limited";
  createdAt: string;
};

export type ApiUsageAnalyticsClient = {
  apiClientId: string;
  name: string;
  ownerType: ApiClientRecord["ownerType"];
  status: ApiClientRecord["status"];
  requests: number;
  allowed: number;
  blocked: number;
  rateLimited: number;
  activeKeys: number;
  revokedKeys: number;
  webhookSubscriptions: number;
  webhookDeliveries: number;
  lastRequestAt?: string;
  topEvents: Array<{ eventType: string; count: number }>;
};

export type ApiUsageAnalyticsSummary = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  windowDays: number;
  since: string;
  retentionPolicy: {
    auditRetentionDays: number;
    retentionCutoff: string;
    retentionCandidates: number;
    purgeStatus: "blocked_pending_owner_approval";
    archiveRequired: boolean;
    legalHoldReviewRequired: boolean;
  };
  totals: {
    clients: number;
    requests: number;
    allowed: number;
    blocked: number;
    rateLimited: number;
    activeKeys: number;
    revokedKeys: number;
    webhookDeliveries: number;
  };
  clients: ApiUsageAnalyticsClient[];
  topEvents: Array<{ eventType: string; count: number }>;
  nextActions: string[];
};

export type ApiAuthenticationResult =
  | {
      ok: true;
      client: ApiClientRecord;
      apiKeyId?: string;
      rateLimit: {
        limit: number;
        windowSeconds: number;
      };
    }
  | {
      ok: false;
      status: 401 | 403 | 429;
      error: string;
      retryAfterSeconds?: number;
    };

export type WebhookDeliveryAttemptRecord = {
  id: string;
  deliveryId: string;
  targetUrl: string;
  status: "delivered" | "failed" | "blocked" | "dry_run";
  statusCode?: number;
  error?: string;
  signaturePreview?: string;
  createdAt: string;
};

export type ProcessWebhookDeliveriesInput = {
  limit?: number;
  dryRun?: boolean;
};

export type ProcessWebhookDeliveriesResult = {
  processed: number;
  delivered: number;
  failed: number;
  blocked: number;
  dryRun: boolean;
  attempts: WebhookDeliveryAttemptRecord[];
};

export type RetryWebhookDeliveriesInput = {
  deliveryIds?: string[];
  status?: Extract<WebhookDeliveryRecord["status"], "failed" | "blocked">;
  limit?: number;
  reason?: string;
  actorId?: string;
};

export type RetryWebhookDeliveriesResult = {
  requeued: number;
  deliveryIds: string[];
  status: "queued";
};

export type ReplayWebhookDeliveriesInput = {
  deliveryIds?: string[];
  status?: Extract<WebhookDeliveryRecord["status"], "failed" | "blocked" | "delivered">;
  limit?: number;
  reason?: string;
  actorId?: string;
};

export type ReplayWebhookDeliveriesResult = {
  replayed: number;
  sourceDeliveryIds: string[];
  replayedDeliveryIds: string[];
  status: "queued";
};

export type WebhookRetrySchedulerInput = {
  retryLimit?: number;
  deliveryLimit?: number;
  includeBlocked?: boolean;
  dryRun?: boolean;
  actorId?: string;
  reason?: string;
};

export type WebhookRetrySchedulerResult = {
  dryRun: boolean;
  retryLimit: number;
  deliveryLimit: number;
  failedCandidates: number;
  blockedCandidates: number;
  failedRetry: RetryWebhookDeliveriesResult;
  blockedRetry?: RetryWebhookDeliveriesResult;
  delivery: ProcessWebhookDeliveriesResult;
  nextActions: string[];
};
