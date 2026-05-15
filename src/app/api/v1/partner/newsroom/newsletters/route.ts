import { NextResponse } from "next/server";
import type { ArticleRecord, NewsletterEditionRecord } from "@/lib/domain/newsroom";
import { listNewsletterEditions, listPublishedArticles } from "@/lib/newsroom/newsroom";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  applyPartnerPagination,
  partnerAuthErrorResponse,
  partnerPaginationFromRequest,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

const publicNewsletterStatuses: NewsletterEditionRecord["status"][] = ["approved", "scheduled", "sent"];

type PartnerNewsletterEdition = Pick<
  NewsletterEditionRecord,
  "id" | "status" | "subject" | "audience" | "intro" | "scheduledFor" | "sentAt" | "createdAt"
> & {
  articleIds: string[];
  articleCount: number;
  linkedArticles: Array<{
    id: string;
    title: string;
    slug: string;
    canonicalUrl: string;
  }>;
  deliveryRules: {
    status: "public_only";
    recipientDetailsExposed: false;
    deliveryAttemptsExposed: false;
    unsubscribeRequired: true;
  };
};

function csvValues(value: string | null) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function newsletterStatusFromRequest(value: string | null) {
  return publicNewsletterStatuses.includes(value as NewsletterEditionRecord["status"])
    ? (value as NewsletterEditionRecord["status"])
    : undefined;
}

function isDefinedArticle(article: ArticleRecord | undefined): article is ArticleRecord {
  return Boolean(article);
}

function newsletterMatches(
  edition: PartnerNewsletterEdition,
  input: { audience: string[]; status?: NewsletterEditionRecord["status"]; q?: string }
) {
  const searchable = [edition.subject, edition.intro ?? "", edition.linkedArticles.map((article) => article.title).join(" ")]
    .join(" ")
    .toLowerCase();

  return (
    (!input.status || edition.status === input.status) &&
    (!input.q || searchable.includes(input.q.toLowerCase())) &&
    (!input.audience.length || input.audience.some((audience) => edition.audience.map((item) => item.toLowerCase()).includes(audience)))
  );
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "newsroom:read", {
      eventType: "partner.newsroom.newsletters.list",
      subjectType: "newsletter_editions"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      audience: csvValues(searchParams.get("audience")),
      status: newsletterStatusFromRequest(searchParams.get("status")),
      q: searchParams.get("q")?.trim() || undefined
    };
    const articles = await listPublishedArticles();
    const articleById = new Map(articles.map((article) => [article.id, article]));
    const newsletters = (await listNewsletterEditions())
      .filter((edition) => publicNewsletterStatuses.includes(edition.status))
      .map((edition): PartnerNewsletterEdition => {
        const linkedArticles = edition.articleIds
          .map((articleId) => articleById.get(articleId))
          .filter(isDefinedArticle)
          .map((article) => ({
            id: article.id,
            title: article.title,
            slug: article.slug,
            canonicalUrl: `/guides/${article.slug}`
          }));

        return {
          id: edition.id,
          status: edition.status,
          subject: edition.subject,
          audience: edition.audience,
          intro: edition.intro,
          scheduledFor: edition.scheduledFor,
          sentAt: edition.sentAt,
          createdAt: edition.createdAt,
          articleIds: edition.articleIds,
          articleCount: linkedArticles.length,
          linkedArticles,
          deliveryRules: {
            status: "public_only",
            recipientDetailsExposed: false,
            deliveryAttemptsExposed: false,
            unsubscribeRequired: true
          }
        };
      })
      .filter((edition) => newsletterMatches(edition, filters));
    const pagination = partnerPaginationFromRequest(request, newsletters.length);

    return NextResponse.json(
      {
        data: applyPartnerPagination(newsletters, pagination),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: newsletters.length,
          filters,
          pagination,
          contentRules: {
            statuses: publicNewsletterStatuses,
            attributionRequired: true,
            recipientDetailsExcluded: true,
            deliveryAttemptsExcluded: true
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
