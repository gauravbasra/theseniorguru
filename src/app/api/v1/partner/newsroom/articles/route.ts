import { NextResponse } from "next/server";
import type { ArticleRecord } from "@/lib/domain/newsroom";
import { listPublishedArticles } from "@/lib/newsroom/newsroom";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  applyPartnerPagination,
  partnerAuthErrorResponse,
  partnerPaginationFromRequest,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

type PartnerNewsroomArticle = Pick<
  ArticleRecord,
  "id" | "title" | "slug" | "dek" | "byline" | "sourceLinks" | "aiAssisted" | "publishedAt" | "createdAt"
> & {
  bodyPreview: string;
  topicTags: string[];
  audience: string[];
  canonicalUrl: string;
};

function csvValues(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function articleMatches(article: PartnerNewsroomArticle, input: { audience: string[]; topicTags: string[]; q?: string; slug?: string }) {
  const searchable = [
    article.title,
    article.dek ?? "",
    article.bodyPreview,
    article.topicTags.join(" "),
    article.audience.join(" ")
  ].join(" ").toLowerCase();

  return (
    (!input.slug || article.slug === input.slug) &&
    (!input.q || searchable.includes(input.q.toLowerCase())) &&
    (!input.audience.length || input.audience.some((audience) => article.audience.includes(audience))) &&
    (!input.topicTags.length || input.topicTags.some((tag) => article.topicTags.includes(tag)))
  );
}

function inferTopicTags(article: ArticleRecord) {
  const text = [article.title, article.dek ?? "", article.body].join(" ").toLowerCase();
  const tags = new Set<string>();

  if (text.includes("memory care")) tags.add("memory-care");
  if (text.includes("assisted living")) tags.add("assisted-living");
  if (text.includes("tour")) tags.add("tour-planning");
  if (text.includes("staffing") || text.includes("policy") || text.includes("regulatory")) tags.add("policy");

  return Array.from(tags);
}

function inferAudience(article: ArticleRecord) {
  const text = [article.title, article.dek ?? "", article.body].join(" ").toLowerCase();
  const audience = new Set<string>();

  if (text.includes("families") || text.includes("caregiver")) audience.add("families");
  if (text.includes("operator") || text.includes("community")) audience.add("providers");

  return Array.from(audience);
}

function mapPartnerArticle(article: ArticleRecord): PartnerNewsroomArticle {
  const bodyPreview = article.body.replace(/\s+/g, " ").trim().slice(0, 420);

  return {
    id: article.id,
    title: article.title,
    slug: article.slug,
    dek: article.dek,
    byline: article.byline,
    bodyPreview,
    sourceLinks: article.sourceLinks,
    aiAssisted: article.aiAssisted,
    publishedAt: article.publishedAt,
    createdAt: article.createdAt,
    topicTags: inferTopicTags(article),
    audience: inferAudience(article),
    canonicalUrl: `/guides/${article.slug}`
  };
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "newsroom:read", {
      eventType: "partner.newsroom.articles.list",
      subjectType: "published_articles"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      audience: csvValues(searchParams.get("audience")),
      topicTags: csvValues(searchParams.get("topicTag") ?? searchParams.get("topicTags")),
      q: searchParams.get("q")?.trim() || undefined,
      slug: searchParams.get("slug")?.trim() || undefined
    };
    const articles = (await listPublishedArticles())
      .map(mapPartnerArticle)
      .filter((article) => articleMatches(article, filters));
    const pagination = partnerPaginationFromRequest(request, articles.length);

    return NextResponse.json(
      {
        data: applyPartnerPagination(articles, pagination),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: articles.length,
          filters,
          pagination,
          contentRules: {
            status: "published_only",
            attributionRequired: true,
            bodyMode: "preview",
            sourceLinksIncluded: true,
            draftAndPolicyBlockedContentExcluded: true
          },
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
