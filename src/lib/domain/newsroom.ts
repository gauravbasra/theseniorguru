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
