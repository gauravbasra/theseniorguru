import { NextResponse } from "next/server";
import { getProviderNewsletterAnalytics } from "@/lib/newsroom/newsroom";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";
import { getProviderById } from "@/lib/providers";

function countBy<T>(items: T[], getKey: (item: T) => string | undefined) {
  return Object.entries(
    items.reduce<Record<string, number>>((counts, item) => {
      const key = getKey(item);

      if (key) {
        counts[key] = (counts[key] ?? 0) + 1;
      }

      return counts;
    }, {})
  )
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "newsroom:read", {
      eventType: "partner.providers.newsletter_summary",
      subjectType: "newsletter_editions",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const analytics = await getProviderNewsletterAnalytics(provider.id);

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
          generatedAt: analytics.generatedAt,
          totals: analytics.totals,
          distributions: {
            editionsByStatus: countBy(analytics.editions, (edition) => edition.status),
            editionsByAudience: countBy(
              analytics.editions.flatMap((edition) => edition.audience),
              (audience) => audience
            ),
            deliveryAttemptsByStatus: countBy(analytics.deliveryHealth, (delivery) => delivery.status),
            deliveryAttemptsByProvider: countBy(analytics.deliveryHealth, (delivery) => delivery.deliveryProvider)
          },
          editions: analytics.editions,
          deliveryHealth: analytics.deliveryHealth.map((delivery) => ({
            editionId: delivery.editionId,
            status: delivery.status,
            deliveryProvider: delivery.deliveryProvider,
            deliveryMode: delivery.deliveryMode,
            blockers: delivery.blockers,
            sentAt: delivery.sentAt,
            createdAt: delivery.createdAt
          })),
          blockers: analytics.blockers,
          nextActions: analytics.nextActions
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
            providerScopedNewsletterMetricsOnly: true,
            aggregatePerformanceOnly: true,
            recipientIdentityExcluded: true,
            recipientSegmentsExcluded: true,
            deliveryPayloadPreviewExcluded: true,
            deliveryAttemptIdsExcluded: true,
            rawMetricPayloadsExcluded: true
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
