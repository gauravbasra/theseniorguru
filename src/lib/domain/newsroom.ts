export type NewsItemRecord = {
  id: string;
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
  title: string;
  sourceUrl?: string;
  sourceName?: string;
  summary?: string;
  audience?: string[];
  topicTags?: string[];
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

export type NewsroomReadinessSummary = {
  generatedAt: string;
  status: "ready" | "action_required" | "blocked";
  sourceSummary: {
    total: number;
    newItems: number;
    triagedItems: number;
    blockedByPolicy: number;
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
