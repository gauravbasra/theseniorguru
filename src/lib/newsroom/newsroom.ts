import type {
  ArticleDerivativeRecord,
  ArticleRecord,
  CreateArticleInput,
  CreateNewsItemInput,
  NewsItemRecord
} from "@/lib/domain/newsroom";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedNewsItems: NewsItemRecord[] = [
  {
    id: "seed-news-regulatory",
    status: "triaged",
    title: "Senior care operators are watching staffing and affordability updates",
    sourceName: "Editorial seed",
    summary: "A placeholder newsroom item for regulatory and operator-facing coverage.",
    audience: ["providers", "families"],
    topicTags: ["policy", "senior-care"],
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function mapNewsItem(row: Record<string, unknown>): NewsItemRecord {
  return {
    id: String(row.id),
    status: row.status as NewsItemRecord["status"],
    title: String(row.title),
    sourceUrl: row.source_url ? String(row.source_url) : undefined,
    sourceName: row.source_name ? String(row.source_name) : undefined,
    summary: row.summary ? String(row.summary) : undefined,
    audience: Array.isArray(row.audience) ? row.audience.map(String) : [],
    topicTags: Array.isArray(row.topic_tags) ? row.topic_tags.map(String) : [],
    createdAt: String(row.created_at)
  };
}

function mapArticle(row: Record<string, unknown>): ArticleRecord {
  return {
    id: String(row.id),
    newsItemId: row.news_item_id ? String(row.news_item_id) : undefined,
    status: row.status as ArticleRecord["status"],
    byline: String(row.byline),
    title: String(row.title),
    slug: String(row.slug),
    dek: row.dek ? String(row.dek) : undefined,
    body: String(row.body),
    sourceLinks: Array.isArray(row.source_links) ? row.source_links as ArticleRecord["sourceLinks"] : [],
    aiAssisted: Boolean(row.ai_assisted),
    publishedAt: row.published_at ? String(row.published_at) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listNewsItems(): Promise<NewsItemRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedNewsItems;
  }

  const { data, error } = await supabase.from("news_items").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Newsroom inbox query failed: ${error.message}`);
  }

  return (data ?? []).map(mapNewsItem);
}

export async function createNewsItem(input: CreateNewsItemInput): Promise<NewsItemRecord> {
  const policy = await runPolicyCheck({
    subjectType: "news_item",
    actionKey: "ingest_news_item",
    input
  });

  const status = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "new";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-news-${Date.now()}`,
      status,
      title: input.title,
      sourceUrl: input.sourceUrl,
      sourceName: input.sourceName,
      summary: input.summary,
      audience: input.audience ?? [],
      topicTags: input.topicTags ?? [],
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("news_items")
    .insert({
      status,
      title: input.title,
      source_url: input.sourceUrl,
      source_name: input.sourceName,
      summary: input.summary,
      audience: input.audience ?? [],
      topic_tags: input.topicTags ?? []
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`News item creation failed: ${error.message}`);
  }

  return mapNewsItem(data);
}

export async function createArticleDraft(input: CreateArticleInput): Promise<ArticleRecord> {
  const body = [
    "This AI-assisted draft is designed to add original Senior Guru analysis rather than republish third-party content.",
    "",
    "What families should know: senior care decisions are easier when listings are complete, direct contact is free, and sponsored placements are labeled.",
    "",
    "What operators should know: local trust is built through accurate profiles, events, reviews, and consistent educational publishing."
  ].join("\n");

  const policy = await runPolicyCheck({
    subjectType: "article",
    actionKey: "draft_article",
    input: { ...input, body }
  });

  const status = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "pending_review";
  const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-article-${Date.now()}`,
      newsItemId: input.newsItemId,
      status,
      byline: input.byline,
      title: input.title,
      slug,
      dek: input.dek,
      body,
      sourceLinks: input.sourceLinks ?? [],
      aiAssisted: true,
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("published_articles")
    .insert({
      news_item_id: input.newsItemId,
      status,
      byline: input.byline,
      title: input.title,
      slug,
      dek: input.dek,
      body,
      source_links: input.sourceLinks ?? [],
      ai_assisted: true
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Article draft creation failed: ${error.message}`);
  }

  return mapArticle(data);
}

export async function publishArticle(articleId: string) {
  const policy = await runPolicyCheck({
    subjectType: "article",
    subjectId: articleId,
    actionKey: "publish_article",
    input: { articleId }
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Article blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    await supabase
      .from("published_articles")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", articleId);
  }

  return { id: articleId, status: "published", policyDecision: policy.decision };
}

export async function generateArticleSocial(articleId: string): Promise<ArticleDerivativeRecord[]> {
  const derivatives: ArticleDerivativeRecord[] = [
    {
      id: `social-linkedin-${Date.now()}`,
      articleId,
      derivativeType: "social_post",
      channel: "linkedin",
      title: "Senior care should be transparent",
      body: "The Senior Guru approach is simple: complete listings, direct contact, labeled sponsorships, and local community support.",
      payload: { generatedBy: "newsroom-social-v1" }
    },
    {
      id: `newsletter-${Date.now()}`,
      articleId,
      derivativeType: "newsletter_blurb",
      channel: "email",
      title: "This week in senior care",
      body: "A practical take for families and operators from The Senior Guru newsroom.",
      payload: { generatedBy: "newsroom-social-v1" }
    }
  ];

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    await supabase.from("article_derivatives").insert(
      derivatives.map((derivative) => ({
        article_id: articleId,
        derivative_type: derivative.derivativeType,
        channel: derivative.channel,
        title: derivative.title,
        body: derivative.body,
        payload: derivative.payload
      }))
    );
  }

  return derivatives;
}

