import { NextResponse } from "next/server";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";
import { getProviderById } from "@/lib/providers";
import { listPartnerReviews, listReviewSentiment } from "@/lib/reviews/reviews";

function average(values: number[]) {
  if (!values.length) {
    return undefined;
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100;
}

function ratingDistribution(ratings: number[]) {
  return [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count: ratings.filter((value) => value === rating).length
  }));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "reviews:read", {
      eventType: "partner.providers.review_summary",
      subjectType: "reviews",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const [reviews, sentimentRecords] = await Promise.all([
      listPartnerReviews({ providerId: provider.id }),
      listReviewSentiment(provider.id)
    ]);
    const ratings = reviews.map((review) => review.rating);
    const sourceCounts = reviews.reduce<Record<string, number>>((counts, review) => {
      counts[review.source] = (counts[review.source] ?? 0) + 1;
      return counts;
    }, {});

    return NextResponse.json(
      {
        data: {
          provider: {
            id: provider.id,
            slug: provider.slug,
            name: provider.name,
            status: provider.status,
            city: provider.city,
            state: provider.state
          },
          generatedAt: new Date().toISOString(),
          summary: {
            publishedReviews: reviews.length,
            averageRating: average(ratings),
            ratingDistribution: ratingDistribution(ratings),
            latestPublishedAt: reviews[0]?.createdAt,
            sources: Object.entries(sourceCounts)
              .map(([source, count]) => ({ source, count }))
              .sort((left, right) => right.count - left.count || left.source.localeCompare(right.source))
          },
          sentiment: {
            positive: sentimentRecords.filter((record) => record.sentiment === "positive").length,
            neutral: sentimentRecords.filter((record) => record.sentiment === "neutral").length,
            negative: sentimentRecords.filter((record) => record.sentiment === "negative").length,
            averageScore: average(sentimentRecords.map((record) => record.score))
          }
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          lookup: {
            requestedId: id,
            matchedId: provider.id,
            matchedSlug: provider.slug
          },
          contentRules: {
            aggregateSummaryOnly: true,
            publishedReviewsOnly: true,
            reviewerIdentityExcluded: true,
            reviewBodyExcluded: true,
            moderationStatusExcluded: true,
            moderationNotesExcluded: true,
            requestRecipientDetailsExcluded: true
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
