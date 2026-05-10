export type ApiClientScope =
  | "providers:read"
  | "events:read"
  | "reviews:read"
  | "campaigns:read"
  | "ads:read"
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

export type ApiAuthenticationResult =
  | {
      ok: true;
      client: ApiClientRecord;
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
