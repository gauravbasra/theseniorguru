import type {
  ArticleDerivativeRecord,
  ArticleRecord,
  CreateArticleInput,
  CreateNewsItemInput,
  NewsItemRecord,
  NewsroomReadinessSummary
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
const seedArticles: ArticleRecord[] = [
  {
    id: "seed-article-memory-care-tour-questions",
    status: "published",
    byline: "Gaurav Basra",
    title: "Memory Care Tour Questions Families Should Ask Before They Feel Rushed",
    slug: "memory-care-tour-questions-families-should-ask-before-they-feel-rushed",
    dek:
      "A practical Senior Guru guide for families comparing memory care communities and operators building trust through transparent answers.",
    body: [
      "Memory care tours can feel emotional and rushed. Families are often trying to understand safety, staffing, daily routines, cost, communication, and whether a community feels warm enough for someone they love.",
      "Start with the questions that reveal day-to-day care. Ask how the team handles sundowning, wandering risk, medication changes, family updates, meals, activities, and transitions after a difficult week.",
      "Then compare practical details across communities. Look at direct contact options, care levels, pricing context, reviews, nearby hospitals, family visitation patterns, and whether the community can explain what happens after the first tour.",
      "The Senior Guru approach is simple: families should be able to compare local options without pressure, and communities should be able to earn trust through clear profiles, helpful events, real reviews, and fast follow-up."
    ].join("\n\n"),
    sourceLinks: [
      {
        title: "The Senior Guru editorial guidance",
        url: "https://theseniorguru.com/senior-care/co/denver/memory-care"
      }
    ],
    aiAssisted: true,
    publishedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];
const seedDerivatives: ArticleDerivativeRecord[] = [];

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

  const status: NewsItemRecord["status"] = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "new";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const item = {
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

    seedNewsItems.unshift(item);
    return item;
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

  const status: ArticleRecord["status"] = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "pending_review";
  const slug = `${slugify(input.title)}-${Date.now().toString(36)}`;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const article = {
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

    seedArticles.unshift(article);
    return article;
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
  const publishedAt = new Date().toISOString();

  if (!supabase) {
    const article = seedArticles.find((candidate) => candidate.id === articleId);

    if (article) {
      article.status = "published";
      article.publishedAt = publishedAt;
    }

    return { id: articleId, status: "published", policyDecision: policy.decision };
  }

  if (supabase) {
    const { error } = await supabase
      .from("published_articles")
      .update({ status: "published", published_at: publishedAt })
      .eq("id", articleId);

    if (error) {
      throw new Error(`Article publish failed: ${error.message}`);
    }
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
  await persistDerivatives(derivatives, supabase);

  return derivatives;
}

export async function generateArticlePodcastBrief(articleId: string): Promise<ArticleDerivativeRecord> {
  const policy = await runPolicyCheck({
    subjectType: "article_derivative",
    subjectId: articleId,
    actionKey: "generate_podcast_brief",
    input: { articleId, derivativeType: "podcast_brief" }
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Podcast brief blocked by policy");
  }

  const derivative: ArticleDerivativeRecord = {
    id: `podcast-brief-${Date.now()}`,
    articleId,
    derivativeType: "podcast_brief",
    channel: "podcast",
    title: "Senior Guru conversation brief",
    body:
      "Opening: explain the family problem in plain language. Segment 1: what changed in the market. Segment 2: how families should evaluate local care options. Segment 3: what operators can do to build trust without referral pressure. Close with direct resources and transparent source links.",
    payload: {
      generatedBy: "newsroom-podcast-v1",
      format: "interview-outline",
      requiredApprovals: ["editorial", "byline-owner"]
    }
  };

  const supabase = getSupabaseAdminClient();
  await persistDerivatives([derivative], supabase);

  return derivative;
}

export async function getNewsroomReadiness(): Promise<NewsroomReadinessSummary> {
  const [sources, articles, derivatives] = await Promise.all([
    listNewsItems(),
    listArticles(),
    listArticleDerivatives()
  ]);
  const newItems = sources.filter((item) => item.status === "new").length;
  const triagedItems = sources.filter((item) => item.status === "triaged").length;
  const blockedSources = sources.filter((item) => item.status === "blocked_by_policy").length;
  const pendingReview = articles.filter((article) => article.status === "pending_review").length;
  const approved = articles.filter((article) => article.status === "approved").length;
  const published = articles.filter((article) => article.status === "published").length;
  const blockedArticles = articles.filter((article) => article.status === "blocked_by_policy").length;
  const socialPosts = derivatives.filter((derivative) => derivative.derivativeType === "social_post").length;
  const newsletterBlurbs = derivatives.filter((derivative) => derivative.derivativeType === "newsletter_blurb").length;
  const podcastBriefs = derivatives.filter((derivative) => derivative.derivativeType === "podcast_brief").length;
  const appFeedPosts = derivatives.filter((derivative) => derivative.derivativeType === "app_feed_post").length;
  const blockers: string[] = [];

  if (!sources.length || (!newItems && !triagedItems)) {
    blockers.push("No fresh or triaged source items are ready for editorial drafting.");
  }

  if (!pendingReview && !approved && !published) {
    blockers.push("No AI-assisted article draft is waiting for review or publication.");
  }

  if (!published) {
    blockers.push("No article has been published for SEO authority building.");
  }

  if (!socialPosts || !newsletterBlurbs) {
    blockers.push("No social and newsletter derivatives have been generated.");
  }

  if (!podcastBriefs) {
    blockers.push("No podcast/interview brief has been generated from the article pipeline.");
  }

  if (blockedSources || blockedArticles) {
    blockers.push("One or more newsroom items are blocked by policy and need editorial review.");
  }

  return {
    generatedAt: new Date().toISOString(),
    status: blockedSources || blockedArticles ? "blocked" : blockers.length ? "action_required" : "ready",
    sourceSummary: {
      total: sources.length,
      newItems,
      triagedItems,
      blockedByPolicy: blockedSources
    },
    articleSummary: {
      total: articles.length,
      pendingReview,
      approved,
      published,
      blockedByPolicy: blockedArticles
    },
    derivativeSummary: {
      total: derivatives.length,
      socialPosts,
      newsletterBlurbs,
      podcastBriefs,
      appFeedPosts
    },
    blockers,
    nextActions: blockers.length ? blockers : ["Newsroom engine is ready for the next source-to-publication cycle."]
  };
}

export async function listPublishedArticles(): Promise<ArticleRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedArticles.filter((article) => article.status === "published");
  }

  const { data, error } = await supabase
    .from("published_articles")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });

  if (error) {
    throw new Error(`Published article query failed: ${error.message}`);
  }

  return (data ?? []).map(mapArticle);
}

export async function getPublishedArticleBySlug(slug: string): Promise<ArticleRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedArticles.find((article) => article.status === "published" && article.slug === slug) ?? null;
  }

  const { data, error } = await supabase
    .from("published_articles")
    .select("*")
    .eq("status", "published")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    throw new Error(`Published article lookup failed: ${error.message}`);
  }

  return data ? mapArticle(data) : null;
}

async function listArticles(): Promise<ArticleRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedArticles;
  }

  const { data, error } = await supabase.from("published_articles").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Article query failed: ${error.message}`);
  }

  return (data ?? []).map(mapArticle);
}

function mapDerivative(row: Record<string, unknown>): ArticleDerivativeRecord {
  return {
    id: String(row.id),
    articleId: String(row.article_id),
    derivativeType: row.derivative_type as ArticleDerivativeRecord["derivativeType"],
    channel: String(row.channel),
    title: row.title ? String(row.title) : undefined,
    body: row.body ? String(row.body) : undefined,
    payload: row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
      ? row.payload as Record<string, unknown>
      : {}
  };
}

async function listArticleDerivatives(): Promise<ArticleDerivativeRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedDerivatives;
  }

  const { data, error } = await supabase.from("article_derivatives").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Article derivative query failed: ${error.message}`);
  }

  return (data ?? []).map(mapDerivative);
}

async function persistDerivatives(
  derivatives: ArticleDerivativeRecord[],
  supabase: ReturnType<typeof getSupabaseAdminClient>
) {
  if (!supabase) {
    seedDerivatives.unshift(...derivatives);
    return;
  }

  const { error } = await supabase.from("article_derivatives").insert(
    derivatives.map((derivative) => ({
      article_id: derivative.articleId,
      derivative_type: derivative.derivativeType,
      channel: derivative.channel,
      title: derivative.title,
      body: derivative.body,
      payload: derivative.payload
    }))
  );

  if (error) {
    throw new Error(`Article derivative creation failed: ${error.message}`);
  }
}
