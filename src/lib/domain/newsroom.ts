export type NewsItemRecord = {
  id: string;
  contentSourceId?: string;
  status: "new" | "triaged" | "assigned" | "drafted" | "ignored" | "blocked_by_policy";
  title: string;
  sourceUrl?: string;
  sourceName?: string;
  summary?: string;
  audience: string[];
  topicTags: string[];
  createdAt: string;
};

export type CreateNewsItemInput = {
  contentSourceId?: string;
  title: string;
  sourceUrl?: string;
  sourceName?: string;
  summary?: string;
  audience?: string[];
  topicTags?: string[];
};

export type ContentSourceRecord = {
  id: string;
  name: string;
  sourceType: "rss" | "manual_url" | "interview" | "regulatory" | "platform_data";
  url?: string;
  reviewStatus: "pending" | "approved" | "blocked" | "needs_legal_review";
  copyrightNotes?: string;
  createdAt: string;
};

export type CreateContentSourceInput = {
  name: string;
  sourceType: ContentSourceRecord["sourceType"];
  url?: string;
  reviewStatus?: ContentSourceRecord["reviewStatus"];
  copyrightNotes?: string;
};

export type RssFeedItemInput = {
  title: string;
  link?: string;
  summary?: string;
  publishedAt?: string;
};

export type ImportRssFeedInput = {
  contentSourceId?: string;
  feedUrl?: string;
  sourceName?: string;
  audience?: string[];
  topicTags?: string[];
  limit?: number;
  dryRun?: boolean;
  items?: RssFeedItemInput[];
};

export type ImportRssFeedResult = {
  sourceId?: string;
  sourceName: string;
  feedUrl?: string;
  dryRun: boolean;
  processed: number;
  staged: number;
  blocked: number;
  skipped: number;
  items: NewsItemRecord[];
  policyDecisions: string[];
};

export type RunScheduledRssImportsInput = {
  dryRun?: boolean;
  limit?: number;
  contentSourceIds?: string[];
  items?: RssFeedItemInput[];
};

export type RunScheduledRssImportsResult = {
  generatedAt: string;
  dryRun: boolean;
  sourceCount: number;
  processed: number;
  staged: number;
  blocked: number;
  skipped: number;
  runs: ImportRssFeedResult[];
  skippedSources: Array<{ id: string; name: string; reason: string }>;
  nextActions: string[];
};

export type ArticleRecord = {
  id: string;
  newsItemId?: string;
  status: "draft" | "pending_review" | "approved" | "published" | "blocked_by_policy";
  byline: string;
  title: string;
  slug: string;
  dek?: string;
  body: string;
  sourceLinks: Array<{ title?: string; url: string }>;
  aiAssisted: boolean;
  publishedAt?: string;
  createdAt: string;
};

export type CreateArticleInput = {
  newsItemId?: string;
  byline: string;
  title: string;
  dek?: string;
  sourceLinks?: Array<{ title?: string; url: string }>;
};

export type PublishArticleInput = {
  articleId: string;
  actorId?: string;
  dryRun?: boolean;
};

export type PublishArticleResult = {
  article: ArticleRecord;
  dryRun: boolean;
  policyDecision: string;
  previousStatus: ArticleRecord["status"];
  nextStatus: ArticleRecord["status"];
  publishedAt?: string;
  auditEventId?: string;
};

export type ArticleDerivativeRecord = {
  id: string;
  articleId: string;
  derivativeType: "social_post" | "newsletter_blurb" | "podcast_brief" | "app_feed_post";
  channel: string;
  title?: string;
  body?: string;
  payload: Record<string, unknown>;
};

export type NewsletterEditionStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "scheduled"
  | "sent"
  | "blocked_by_policy";

export type NewsletterEditionRecord = {
  id: string;
  status: NewsletterEditionStatus;
  subject: string;
  audience: string[];
  articleIds: string[];
  intro?: string;
  scheduledFor?: string;
  sentAt?: string;
  createdAt: string;
};

export type CreateNewsletterEditionInput = {
  subject: string;
  audience?: string[];
  articleIds?: string[];
  intro?: string;
  scheduledFor?: string;
};

export type NewsletterEditionActionInput = {
  actorId?: string;
  notes?: string;
  scheduledFor?: string;
  deliveryProvider?: string;
};

export type NewsletterEditionActionResult = {
  id: string;
  status: NewsletterEditionStatus;
  policyDecision: string;
  scheduledFor?: string;
  sentAt?: string;
};

export type NewsletterDeliveryProvider = "mailjet" | "manual_export";

export type NewsletterDeliveryPreviewInput = {
  editionId: string;
  deliveryProvider?: NewsletterDeliveryProvider;
  actorId?: string;
  notes?: string;
};

export type NewsletterDeliveryPreviewResult = {
  editionId: string;
  status: "ready" | "blocked";
  deliveryProvider: NewsletterDeliveryProvider;
  providerConfigured: boolean;
  canSendLive: boolean;
  subject: string;
  audience: string[];
  articleCount: number;
  recipientSegments: Array<{
    key: string;
    label: string;
    estimatedRecipients: number;
    consentRequired: boolean;
  }>;
  payloadPreview: {
    subject: string;
    preheader: string;
    intro?: string;
    articleIds: string[];
    unsubscribeRequired: boolean;
    tracking: {
      opens: boolean;
      clicks: boolean;
      campaignKey: string;
    };
  };
  blockers: string[];
  nextActions: string[];
  policyDecision: string;
};

export type NewsletterAudienceRecipientExportInput = NewsletterDeliveryPreviewInput & {
  includeSampleRecipients?: boolean;
  senderApproved?: boolean;
  ownerApprovedLiveSend?: boolean;
};

export type NewsletterAudienceRecipientExportResult = {
  editionId: string;
  generatedAt: string;
  status: "export_ready" | "live_ready" | "blocked";
  deliveryProvider: NewsletterDeliveryProvider;
  subject: string;
  audience: string[];
  recipientSegments: NewsletterDeliveryPreviewResult["recipientSegments"];
  recipients: Array<{
    email: string;
    segmentKey: string;
    consentStatus: "synthetic_demo_consent";
    mergeFields: {
      firstName: string;
      audienceLabel: string;
      campaignKey: string;
    };
  }>;
  totals: {
    segments: number;
    estimatedRecipients: number;
    exportedRecipients: number;
  };
  mailjet: {
    credentialConfigured: boolean;
    senderApproved: boolean;
    ownerApprovedLiveSend: boolean;
    sendMode: NewsletterDeliveryMode;
    canSendLive: boolean;
  };
  preview: NewsletterDeliveryPreviewResult;
  blockers: string[];
  nextActions: string[];
  policyDecision: string;
};

export type NewsletterDeliveryMode = "preview" | "live";

export type NewsletterDeliveryAttemptStatus = "ready" | "sent" | "blocked" | "dry_run";

export type NewsletterDeliverySendInput = NewsletterDeliveryPreviewInput & {
  dryRun?: boolean;
  deliveryId?: string;
};

export type NewsletterDeliverySendResult = {
  editionId: string;
  status: NewsletterDeliveryAttemptStatus;
  deliveryProvider: NewsletterDeliveryProvider;
  deliveryMode: NewsletterDeliveryMode;
  deliveryId: string;
  providerMessageId?: string;
  sentAt?: string;
  actorId?: string;
  preview: NewsletterDeliveryPreviewResult;
  blockers: string[];
  nextActions: string[];
  policyDecision: string;
};

export type NewsletterDeliveryAttemptRecord = {
  id: string;
  newsletterEditionId: string;
  deliveryProvider: NewsletterDeliveryProvider;
  deliveryMode: NewsletterDeliveryMode;
  status: NewsletterDeliveryAttemptStatus;
  recipientSegments: NewsletterDeliveryPreviewResult["recipientSegments"];
  payloadPreview: NewsletterDeliveryPreviewResult["payloadPreview"];
  providerMessageId?: string;
  error?: string;
  policyDecision: string;
  actorId?: string;
  createdAt: string;
  sentAt?: string;
};

export type ProviderNewsletterAnalytics = {
  generatedAt: string;
  providerId: string;
  providerName?: string;
  totals: {
    newsletters: number;
    deliveryAttempts: number;
    sentAttempts: number;
    blockedAttempts: number;
    opens: number;
    clicks: number;
    leads: number;
    clickThroughRate: number;
  };
  editions: Array<{
    id: string;
    subject: string;
    status: NewsletterEditionStatus;
    audience: string[];
    sentAt?: string;
    opens: number;
    clicks: number;
    leads: number;
    clickThroughRate: number;
  }>;
  deliveryHealth: Array<{
    deliveryId: string;
    editionId: string;
    status: NewsletterDeliveryAttemptStatus;
    deliveryProvider: NewsletterDeliveryProvider;
    deliveryMode: NewsletterDeliveryMode;
    recipientSegments: NewsletterDeliveryAttemptRecord["recipientSegments"];
    blockers: string[];
    sentAt?: string;
    createdAt: string;
  }>;
  blockers: string[];
  nextActions: string[];
};

export type ContentPerformanceSubjectType = "article" | "newsletter" | "derivative";

export type ContentPerformanceMetricKey =
  | "view"
  | "click"
  | "share"
  | "save"
  | "newsletter_open"
  | "newsletter_click"
  | "lead";

export type ContentPerformanceMetricRecord = {
  id: string;
  subjectType: ContentPerformanceSubjectType;
  subjectId: string;
  channel: string;
  metricKey: ContentPerformanceMetricKey;
  metricValue: number;
  metricPayload: Record<string, unknown>;
  recordedAt: string;
};

export type RecordContentPerformanceMetricInput = {
  subjectType: ContentPerformanceSubjectType;
  subjectId: string;
  channel?: string;
  metricKey: ContentPerformanceMetricKey;
  metricValue?: number;
  metricPayload?: Record<string, unknown>;
  recordedAt?: string;
};

export type ContentPerformanceSummary = {
  generatedAt: string;
  filters: {
    subjectType?: ContentPerformanceSubjectType;
    subjectId?: string;
    channel?: string;
  };
  totals: {
    metrics: number;
    views: number;
    clicks: number;
    shares: number;
    saves: number;
    newsletterOpens: number;
    newsletterClicks: number;
    leads: number;
    clickThroughRate: number;
  };
  byChannel: Array<{
    channel: string;
    views: number;
    clicks: number;
    leads: number;
    clickThroughRate: number;
  }>;
  topContent: Array<{
    subjectType: ContentPerformanceSubjectType;
    subjectId: string;
    title: string;
    channel: string;
    views: number;
    clicks: number;
    leads: number;
    clickThroughRate: number;
  }>;
  nextActions: string[];
};

export type ContentPerformanceTrendBucket = "day" | "week";

export type ContentPerformanceTrendExportInput = {
  subjectType?: ContentPerformanceSubjectType;
  subjectId?: string;
  channel?: string;
  bucket?: ContentPerformanceTrendBucket;
};

export type ContentPerformanceTrendExportRow = {
  bucketStart: string;
  channel: string;
  subjectType: ContentPerformanceSubjectType;
  subjectId: string;
  title: string;
  views: number;
  clicks: number;
  shares: number;
  saves: number;
  newsletterOpens: number;
  newsletterClicks: number;
  leads: number;
  clickThroughRate: number;
};

export type ContentPerformanceTrendExport = {
  generatedAt: string;
  filters: Required<Pick<ContentPerformanceTrendExportInput, "bucket">> &
    Omit<ContentPerformanceTrendExportInput, "bucket">;
  rowCount: number;
  totals: ContentPerformanceSummary["totals"];
  rows: ContentPerformanceTrendExportRow[];
  csv: string;
  nextActions: string[];
  policyDecision: string;
};

export type NewsroomReadinessSummary = {
  generatedAt: string;
  status: "ready" | "action_required" | "blocked";
  sourceSummary: {
    total: number;
    newItems: number;
    triagedItems: number;
    blockedByPolicy: number;
  };
  sourceRegistrySummary: {
    total: number;
    approved: number;
    pending: number;
    needsLegalReview: number;
    blocked: number;
    rss: number;
  };
  articleSummary: {
    total: number;
    pendingReview: number;
    approved: number;
    published: number;
    blockedByPolicy: number;
  };
  derivativeSummary: {
    total: number;
    socialPosts: number;
    newsletterBlurbs: number;
    podcastBriefs: number;
    appFeedPosts: number;
  };
  blockers: string[];
  nextActions: string[];
};
