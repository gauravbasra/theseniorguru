import type {
  ArticleDerivativeRecord,
  ArticleRecord,
  ContentSourceRecord,
  CreateArticleInput,
  CreateContentSourceInput,
  CreateNewsItemInput,
  CreateNewsletterEditionInput,
  ImportRssFeedInput,
  ImportRssFeedResult,
  NewsItemRecord,
  NewsletterEditionActionInput,
  NewsletterEditionActionResult,
  NewsletterEditionRecord,
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
const seedNewsletterEditions: NewsletterEditionRecord[] = [
  {
    id: "seed-newsletter-family-tour-planning",
    status: "sent",
    subject: "Senior Guru weekly: better memory care tour questions",
    audience: ["families", "caregivers"],
    articleIds: ["seed-article-memory-care-tour-questions"],
    intro: "A practical weekly edition for families comparing senior living options without referral pressure.",
    sentAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];
const seedContentSources: ContentSourceRecord[] = [
  {
    id: "seed-content-source-senior-care-news",
    name: "Senior care editorial watchlist",
    sourceType: "rss",
    url: "https://example.com/senior-care-news/rss.xml",
    reviewStatus: "approved",
    copyrightNotes: "Use for source awareness only. Add original Senior Guru analysis and link attribution.",
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
    contentSourceId: row.content_source_id ? String(row.content_source_id) : undefined,
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

function mapContentSource(row: Record<string, unknown>): ContentSourceRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    sourceType: row.source_type as ContentSourceRecord["sourceType"],
    url: row.url ? String(row.url) : undefined,
    reviewStatus: row.review_status as ContentSourceRecord["reviewStatus"],
    copyrightNotes: row.copyright_notes ? String(row.copyright_notes) : undefined,
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

function mapNewsletterEdition(row: Record<string, unknown>): NewsletterEditionRecord {
  return {
    id: String(row.id),
    status: row.status as NewsletterEditionRecord["status"],
    subject: String(row.subject),
    audience: Array.isArray(row.audience) ? row.audience.map(String) : [],
    articleIds: Array.isArray(row.article_ids) ? row.article_ids.map(String) : [],
    intro: row.intro ? String(row.intro) : undefined,
    scheduledFor: row.scheduled_for ? String(row.scheduled_for) : undefined,
    sentAt: row.sent_at ? String(row.sent_at) : undefined,
    createdAt: String(row.created_at)
  };
}

function normalizeNewsItemKey(input: { sourceUrl?: string; sourceName?: string; title: string }) {
  const url = input.sourceUrl?.trim().toLowerCase().replace(/#.*$/, "").replace(/\/$/, "");

  if (url) {
    return `url:${url}`;
  }

  return `title:${input.sourceName?.trim().toLowerCase() ?? "unknown"}:${slugify(input.title)}`;
}

function assertPolicyAllowsNewsroomAction(
  policy: Awaited<ReturnType<typeof runPolicyCheck>>,
  fallbackMessage: string
) {
  if (policy.decision === "approved" || policy.decision === "approved_with_disclosure") {
    return;
  }

  throw new Error(policy.reasons[0] ?? fallbackMessage);
}

export async function listContentSources(): Promise<ContentSourceRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedContentSources;
  }

  const { data, error } = await supabase
    .from("content_sources")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Newsroom source query failed: ${error.message}`);
  }

  return (data ?? []).map(mapContentSource);
}

export async function createContentSource(input: CreateContentSourceInput): Promise<ContentSourceRecord> {
  const policy = await runPolicyCheck({
    subjectType: "content_source",
    actionKey: "create_content_source",
    input
  });
  const reviewStatus: ContentSourceRecord["reviewStatus"] = policy.decision.startsWith("blocked")
    ? "blocked"
    : policy.decision === "needs_legal_review"
      ? "needs_legal_review"
      : input.reviewStatus ?? "pending";
  const source: ContentSourceRecord = {
    id: `content-source-${Date.now()}`,
    name: input.name,
    sourceType: input.sourceType,
    url: input.url,
    reviewStatus,
    copyrightNotes: input.copyrightNotes,
    createdAt: new Date().toISOString()
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    seedContentSources.unshift(source);
    return source;
  }

  const { data, error } = await supabase
    .from("content_sources")
    .insert({
      name: input.name,
      source_type: input.sourceType,
      url: input.url,
      review_status: reviewStatus,
      copyright_notes: input.copyrightNotes
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Newsroom source creation failed: ${error.message}`);
  }

  return mapContentSource(data);
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
      contentSourceId: input.contentSourceId,
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
      content_source_id: input.contentSourceId,
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

export async function importRssFeed(input: ImportRssFeedInput): Promise<ImportRssFeedResult> {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 25);
  const sources = await listContentSources();
  const source = input.contentSourceId
    ? sources.find((candidate) => candidate.id === input.contentSourceId)
    : sources.find((candidate) => candidate.url === input.feedUrl);
  const sourceName = source?.name ?? input.sourceName ?? input.feedUrl ?? "Editorial RSS source";
  const feedUrl = input.feedUrl ?? source?.url;

  if (source && source.reviewStatus !== "approved") {
    throw new Error("RSS source must be approved before import.");
  }

  if (!source && !feedUrl && !input.items?.length) {
    throw new Error("feedUrl or items are required for RSS import.");
  }

  const rssItems = (input.items?.length ? input.items : await fetchRssItems(feedUrl as string)).slice(0, limit);
  const existingKeys = new Set(
    (await listNewsItems()).map((item) => normalizeNewsItemKey({
      sourceUrl: item.sourceUrl,
      sourceName: item.sourceName,
      title: item.title
    }))
  );
  const createdItems: NewsItemRecord[] = [];
  const policyDecisions: string[] = [];
  let blocked = 0;
  let skipped = 0;

  for (const rssItem of rssItems) {
    if (!rssItem.title?.trim()) {
      skipped += 1;
      continue;
    }

    const itemKey = normalizeNewsItemKey({
      sourceUrl: rssItem.link,
      sourceName,
      title: rssItem.title
    });

    if (existingKeys.has(itemKey)) {
      skipped += 1;
      continue;
    }

    const policy = await runPolicyCheck({
      subjectType: "news_item",
      actionKey: "import_rss_item",
      input: {
        sourceName,
        feedUrl,
        title: rssItem.title,
        summary: rssItem.summary
      }
    });
    policyDecisions.push(policy.decision);

    if (policy.decision.startsWith("blocked")) {
      blocked += 1;
      if (input.dryRun) {
        continue;
      }
    }

    if (input.dryRun) {
      const item: NewsItemRecord = {
        id: `dry-run-rss-${createdItems.length + 1}`,
        contentSourceId: source?.id,
        status: policy.decision.startsWith("blocked") ? "blocked_by_policy" : "new",
        title: rssItem.title,
        sourceUrl: rssItem.link,
        sourceName,
        summary: rssItem.summary,
        audience: input.audience ?? ["families", "providers"],
        topicTags: input.topicTags ?? ["senior-care", "industry-news"],
        createdAt: new Date().toISOString()
      };

      createdItems.push(item);
      existingKeys.add(itemKey);
      continue;
    }

    createdItems.push(await createNewsItem({
      contentSourceId: source?.id,
      title: rssItem.title,
      sourceUrl: rssItem.link,
      sourceName,
      summary: rssItem.summary,
      audience: input.audience ?? ["families", "providers"],
      topicTags: input.topicTags ?? ["senior-care", "industry-news"]
    }));
    existingKeys.add(itemKey);
  }

  return {
    sourceId: source?.id,
    sourceName,
    feedUrl,
    dryRun: Boolean(input.dryRun),
    processed: rssItems.length,
    staged: createdItems.filter((item) => item.status !== "blocked_by_policy").length,
    blocked,
    skipped,
    items: createdItems,
    policyDecisions
  };
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

export async function approveArticle(articleId: string, input: { actorId?: string; notes?: string } = {}) {
  const supabase = getSupabaseAdminClient();
  const approvedAt = new Date().toISOString();

  if (!supabase) {
    const article = seedArticles.find((candidate) => candidate.id === articleId);

    if (!article) {
      throw new Error("Article not found");
    }

    if (article.status === "blocked_by_policy") {
      throw new Error("Blocked articles cannot be approved");
    }

    const policy = await runPolicyCheck({
      subjectType: "article",
      subjectId: articleId,
      actionKey: "approve_article",
      input: {
        articleId,
        title: article.title,
        dek: article.dek,
        body: article.body,
        sourceLinks: article.sourceLinks,
        notes: input.notes
      }
    });

    assertPolicyAllowsNewsroomAction(policy, "Article approval requires policy clearance");

    article.status = "approved";
    return { id: articleId, status: "approved", policyDecision: policy.decision, approvedAt };
  }

  const { data: article, error: lookupError } = await supabase
    .from("published_articles")
    .select("*")
    .eq("id", articleId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Article approval lookup failed: ${lookupError.message}`);
  }

  if (!article) {
    throw new Error("Article not found");
  }

  if (article.status === "blocked_by_policy") {
    throw new Error("Blocked articles cannot be approved");
  }

  const policy = await runPolicyCheck({
    subjectType: "article",
    subjectId: articleId,
    actionKey: "approve_article",
    input: {
      articleId,
      title: article.title,
      dek: article.dek,
      body: article.body,
      sourceLinks: article.source_links,
      notes: input.notes
    }
  });

  assertPolicyAllowsNewsroomAction(policy, "Article approval requires policy clearance");

  const approvalPayload = {
    ...(typeof article.approval_payload === "object" && article.approval_payload ? article.approval_payload : {}),
    approvedAt,
    approvedBy: input.actorId ?? "system",
    notes: input.notes,
    policyDecision: policy.decision
  };

  const { error } = await supabase
    .from("published_articles")
    .update({
      status: "approved",
      approval_payload: approvalPayload,
      updated_at: approvedAt
    })
    .eq("id", articleId);

  if (error) {
    throw new Error(`Article approval failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "article.approved",
    subject_type: "article",
    subject_id: articleId,
    payload: {
      notes: input.notes,
      policyDecision: policy.decision
    }
  });

  return { id: articleId, status: "approved", policyDecision: policy.decision, approvedAt };
}

export async function publishArticle(articleId: string) {
  const supabase = getSupabaseAdminClient();
  const publishedAt = new Date().toISOString();

  if (!supabase) {
    const article = seedArticles.find((candidate) => candidate.id === articleId);

    if (!article) {
      throw new Error("Article not found");
    }

    if (article.status === "published") {
      return { id: articleId, status: "published", policyDecision: "already_published", publishedAt: article.publishedAt };
    }

    if (article.status !== "approved") {
      throw new Error("Article must be approved before publishing");
    }

    const policy = await runPolicyCheck({
      subjectType: "article",
      subjectId: articleId,
      actionKey: "publish_article",
      input: { articleId, title: article.title, dek: article.dek, body: article.body, sourceLinks: article.sourceLinks }
    });

    assertPolicyAllowsNewsroomAction(policy, "Article publish requires policy clearance");

    article.status = "published";
    article.publishedAt = publishedAt;
    return { id: articleId, status: "published", policyDecision: policy.decision, publishedAt };
  }

  const { data: article, error: lookupError } = await supabase
    .from("published_articles")
    .select("*")
    .eq("id", articleId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Article publish lookup failed: ${lookupError.message}`);
  }

  if (!article) {
    throw new Error("Article not found");
  }

  if (article.status === "published") {
    return { id: articleId, status: "published", policyDecision: "already_published", publishedAt: article.published_at };
  }

  if (article.status !== "approved") {
    throw new Error("Article must be approved before publishing");
  }

  const policy = await runPolicyCheck({
    subjectType: "article",
    subjectId: articleId,
    actionKey: "publish_article",
    input: {
      articleId,
      title: article.title,
      dek: article.dek,
      body: article.body,
      sourceLinks: article.source_links
    }
  });

  assertPolicyAllowsNewsroomAction(policy, "Article publish requires policy clearance");

  const { error } = await supabase
    .from("published_articles")
    .update({ status: "published", published_at: publishedAt, updated_at: publishedAt })
    .eq("id", articleId);

  if (error) {
    throw new Error(`Article publish failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_type: "system",
    event_type: "article.published",
    subject_type: "article",
    subject_id: articleId,
    payload: {
      policyDecision: policy.decision,
      slug: article.slug
    }
  });

  return { id: articleId, status: "published", policyDecision: policy.decision, publishedAt };
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

function publicNewsletterStatuses(status: NewsletterEditionRecord["status"]) {
  return status === "approved" || status === "scheduled" || status === "sent";
}

export async function listNewsletterEditions(): Promise<NewsletterEditionRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedNewsletterEditions;
  }

  const { data, error } = await supabase.from("newsletter_editions").select("*").order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Newsletter edition query failed: ${error.message}`);
  }

  return (data ?? []).map(mapNewsletterEdition);
}

export async function getNewsletterEdition(id: string, options: { publicOnly?: boolean } = {}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const edition = seedNewsletterEditions.find((candidate) => candidate.id === id) ?? null;
    if (!edition || (options.publicOnly && !publicNewsletterStatuses(edition.status))) {
      return null;
    }
    return edition;
  }

  let query = supabase.from("newsletter_editions").select("*").eq("id", id);
  if (options.publicOnly) {
    query = query.in("status", ["approved", "scheduled", "sent"]);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Newsletter edition lookup failed: ${error.message}`);
  }

  return data ? mapNewsletterEdition(data) : null;
}

export async function createNewsletterEdition(input: CreateNewsletterEditionInput): Promise<NewsletterEditionRecord> {
  if (!input.subject?.trim()) {
    throw new Error("subject is required");
  }

  const scheduledFor = input.scheduledFor;
  if (scheduledFor && Number.isNaN(new Date(scheduledFor).getTime())) {
    throw new Error("scheduledFor must be a valid ISO date when provided");
  }

  const articles = await listArticles();
  const articleIds = input.articleIds?.length
    ? input.articleIds
    : articles.filter((article) => article.status === "published").slice(0, 3).map((article) => article.id);

  const missingArticle = articleIds.find((articleId) => !articles.some((article) => article.id === articleId));
  if (missingArticle) {
    throw new Error(`Newsletter article not found: ${missingArticle}`);
  }

  const policy = await runPolicyCheck({
    subjectType: "newsletter_edition",
    actionKey: "create_newsletter_edition",
    input: {
      subject: input.subject,
      audience: input.audience ?? ["families", "providers"],
      articleIds,
      intro: input.intro,
      scheduledFor
    }
  });

  const status: NewsletterEditionRecord["status"] = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "draft";
  const createdAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const edition: NewsletterEditionRecord = {
      id: `newsletter-${Date.now()}`,
      status,
      subject: input.subject,
      audience: input.audience ?? ["families", "providers"],
      articleIds,
      intro: input.intro,
      scheduledFor,
      createdAt
    };
    seedNewsletterEditions.unshift(edition);
    return edition;
  }

  const { data, error } = await supabase
    .from("newsletter_editions")
    .insert({
      status,
      subject: input.subject,
      audience: input.audience ?? ["families", "providers"],
      article_ids: articleIds,
      intro: input.intro,
      scheduled_for: scheduledFor
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Newsletter edition creation failed: ${error.message}`);
  }

  return mapNewsletterEdition(data);
}

function getSeedNewsletterEdition(id: string) {
  const edition = seedNewsletterEditions.find((candidate) => candidate.id === id);
  if (!edition) {
    throw new Error("Newsletter edition not found");
  }
  return edition;
}

function assertNewsletterCanBeApproved(edition: NewsletterEditionRecord) {
  if (edition.status === "blocked_by_policy") {
    throw new Error("Blocked newsletter editions cannot be approved");
  }
  if (edition.status === "sent") {
    throw new Error("Sent newsletter editions cannot be re-approved");
  }
}

function assertNewsletterCanBeScheduled(edition: NewsletterEditionRecord) {
  if (edition.status !== "approved" && edition.status !== "scheduled") {
    throw new Error("Newsletter edition must be approved before scheduling");
  }
}

function assertNewsletterCanBeSent(edition: NewsletterEditionRecord) {
  if (edition.status !== "approved" && edition.status !== "scheduled") {
    throw new Error("Newsletter edition must be approved or scheduled before sending");
  }
}

async function policyCheckNewsletterAction(
  edition: NewsletterEditionRecord,
  actionKey: string,
  input: NewsletterEditionActionInput
) {
  const policy = await runPolicyCheck({
    subjectType: "newsletter_edition",
    subjectId: edition.id,
    actionKey,
    input: {
      editionId: edition.id,
      subject: edition.subject,
      audience: edition.audience,
      articleIds: edition.articleIds,
      intro: edition.intro,
      ...input
    }
  });

  assertPolicyAllowsNewsroomAction(policy, "Newsletter action requires policy clearance");
  return policy;
}

export async function approveNewsletterEdition(
  editionId: string,
  input: NewsletterEditionActionInput = {}
): Promise<NewsletterEditionActionResult> {
  const approvedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const edition = getSeedNewsletterEdition(editionId);
    assertNewsletterCanBeApproved(edition);
    const policy = await policyCheckNewsletterAction(edition, "approve_newsletter_edition", input);
    edition.status = "approved";
    return { id: edition.id, status: edition.status, policyDecision: policy.decision };
  }

  const edition = await getNewsletterEdition(editionId);
  if (!edition) {
    throw new Error("Newsletter edition not found");
  }
  assertNewsletterCanBeApproved(edition);
  const policy = await policyCheckNewsletterAction(edition, "approve_newsletter_edition", input);

  const { error } = await supabase
    .from("newsletter_editions")
    .update({
      status: "approved",
      metadata: { approvedAt, approvedBy: input.actorId ?? "system", notes: input.notes, policyDecision: policy.decision },
      updated_at: approvedAt
    })
    .eq("id", editionId);

  if (error) {
    throw new Error(`Newsletter approval failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "newsletter.approved",
    subject_type: "newsletter_edition",
    subject_id: editionId,
    payload: { notes: input.notes, policyDecision: policy.decision }
  });

  return { id: editionId, status: "approved", policyDecision: policy.decision };
}

export async function scheduleNewsletterEdition(
  editionId: string,
  input: NewsletterEditionActionInput
): Promise<NewsletterEditionActionResult> {
  if (!input.scheduledFor || Number.isNaN(new Date(input.scheduledFor).getTime())) {
    throw new Error("scheduledFor must be a valid ISO date");
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const edition = getSeedNewsletterEdition(editionId);
    assertNewsletterCanBeScheduled(edition);
    const policy = await policyCheckNewsletterAction(edition, "schedule_newsletter_edition", input);
    edition.status = "scheduled";
    edition.scheduledFor = input.scheduledFor;
    return { id: edition.id, status: edition.status, policyDecision: policy.decision, scheduledFor: edition.scheduledFor };
  }

  const edition = await getNewsletterEdition(editionId);
  if (!edition) {
    throw new Error("Newsletter edition not found");
  }
  assertNewsletterCanBeScheduled(edition);
  const policy = await policyCheckNewsletterAction(edition, "schedule_newsletter_edition", input);

  const { error } = await supabase
    .from("newsletter_editions")
    .update({
      status: "scheduled",
      scheduled_for: input.scheduledFor,
      metadata: { scheduledBy: input.actorId ?? "system", notes: input.notes, policyDecision: policy.decision },
      updated_at: new Date().toISOString()
    })
    .eq("id", editionId);

  if (error) {
    throw new Error(`Newsletter scheduling failed: ${error.message}`);
  }

  return { id: editionId, status: "scheduled", policyDecision: policy.decision, scheduledFor: input.scheduledFor };
}

export async function sendNewsletterEdition(
  editionId: string,
  input: NewsletterEditionActionInput = {}
): Promise<NewsletterEditionActionResult> {
  const sentAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const edition = getSeedNewsletterEdition(editionId);
    assertNewsletterCanBeSent(edition);
    const policy = await policyCheckNewsletterAction(edition, "send_newsletter_edition", input);
    edition.status = "sent";
    edition.sentAt = sentAt;
    return { id: edition.id, status: edition.status, policyDecision: policy.decision, sentAt };
  }

  const edition = await getNewsletterEdition(editionId);
  if (!edition) {
    throw new Error("Newsletter edition not found");
  }
  assertNewsletterCanBeSent(edition);
  const policy = await policyCheckNewsletterAction(edition, "send_newsletter_edition", input);

  const { error } = await supabase
    .from("newsletter_editions")
    .update({
      status: "sent",
      sent_at: sentAt,
      metadata: {
        sentBy: input.actorId ?? "system",
        deliveryProvider: input.deliveryProvider ?? "manual_newsletter_export",
        notes: input.notes,
        policyDecision: policy.decision
      },
      updated_at: sentAt
    })
    .eq("id", editionId);

  if (error) {
    throw new Error(`Newsletter send failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "newsletter.sent",
    subject_type: "newsletter_edition",
    subject_id: editionId,
    payload: { deliveryProvider: input.deliveryProvider ?? "manual_newsletter_export", policyDecision: policy.decision }
  });

  return { id: editionId, status: "sent", policyDecision: policy.decision, sentAt };
}

export async function getNewsroomReadiness(): Promise<NewsroomReadinessSummary> {
  const [contentSources, sources, articles, derivatives] = await Promise.all([
    listContentSources(),
    listNewsItems(),
    listArticles(),
    listArticleDerivatives()
  ]);
  const approvedContentSources = contentSources.filter((source) => source.reviewStatus === "approved").length;
  const pendingContentSources = contentSources.filter((source) => source.reviewStatus === "pending").length;
  const legalReviewContentSources = contentSources.filter((source) => source.reviewStatus === "needs_legal_review").length;
  const blockedContentSources = contentSources.filter((source) => source.reviewStatus === "blocked").length;
  const rssContentSources = contentSources.filter((source) => source.sourceType === "rss").length;
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

  if (!approvedContentSources) {
    blockers.push("No approved editorial source is ready for RSS/news intake.");
  }

  if (!rssContentSources) {
    blockers.push("No RSS source has been registered for daily industry monitoring.");
  }

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

  if (blockedContentSources || blockedSources || blockedArticles) {
    blockers.push("One or more newsroom sources or items are blocked by policy and need editorial review.");
  }

  return {
    generatedAt: new Date().toISOString(),
    status: blockedContentSources || blockedSources || blockedArticles ? "blocked" : blockers.length ? "action_required" : "ready",
    sourceSummary: {
      total: sources.length,
      newItems,
      triagedItems,
      blockedByPolicy: blockedSources
    },
    sourceRegistrySummary: {
      total: contentSources.length,
      approved: approvedContentSources,
      pending: pendingContentSources,
      needsLegalReview: legalReviewContentSources,
      blocked: blockedContentSources,
      rss: rssContentSources
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

async function fetchRssItems(feedUrl: string) {
  const response = await fetch(feedUrl, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
      "user-agent": "TheSeniorGuru-NewsroomBot/0.1 (+https://theseniorguru.com)"
    },
    next: { revalidate: 900 }
  });

  if (!response.ok) {
    throw new Error(`RSS feed fetch failed with status ${response.status}`);
  }

  return parseRssXml(await response.text());
}

function parseRssXml(xml: string) {
  const itemBlocks = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi), (match) => match[0]);
  const entryBlocks = itemBlocks.length
    ? itemBlocks
    : Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi), (match) => match[0]);

  return entryBlocks.map((block) => ({
    title: readXmlText(block, "title") ?? "Untitled senior care update",
    link: readXmlLink(block),
    summary: readXmlText(block, "description") ?? readXmlText(block, "summary") ?? readXmlText(block, "content"),
    publishedAt: readXmlText(block, "pubDate") ?? readXmlText(block, "updated") ?? readXmlText(block, "published")
  }));
}

function readXmlText(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match?.[1] ? decodeXml(match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/<[^>]+>/g, " ").trim()) : undefined;
}

function readXmlLink(block: string) {
  const hrefMatch = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/i);
  return hrefMatch?.[1] ? decodeXml(hrefMatch[1]) : readXmlText(block, "link");
}

function decodeXml(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function listArticles(): Promise<ArticleRecord[]> {
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
