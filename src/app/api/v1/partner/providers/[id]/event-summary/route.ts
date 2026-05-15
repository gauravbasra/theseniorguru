import { NextResponse } from "next/server";
import { getEventAnalytics } from "@/lib/events/event-analytics";
import { listEvents } from "@/lib/events/events";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";
import { getProviderById } from "@/lib/providers";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "events:read", {
      eventType: "partner.providers.event_summary",
      subjectType: "events",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const allEvents = await listEvents();
    const providerEvents = allEvents.filter((event) => event.providerId === provider.id);
    const analytics = await Promise.all(providerEvents.map((event) => getEventAnalytics(event.id)));
    const now = Date.now();

    const totals = analytics.reduce(
      (summary, item) => {
        summary.rsvps += item.rsvps.total;
        summary.confirmed += item.rsvps.confirmed;
        summary.waitlisted += item.rsvps.waitlisted;
        summary.canceled += item.rsvps.canceled;
        summary.attended += item.rsvps.attended;
        summary.noShow += item.rsvps.noShow;
        summary.promotions += item.promotions.total;
        summary.activePromotions += item.promotions.active;
        summary.promotionBudgetCents += item.promotions.budgetCents;
        summary.adImpressions += item.ads.impressions;
        summary.adClicks += item.ads.clicks;
        return summary;
      },
      {
        rsvps: 0,
        confirmed: 0,
        waitlisted: 0,
        canceled: 0,
        attended: 0,
        noShow: 0,
        promotions: 0,
        activePromotions: 0,
        promotionBudgetCents: 0,
        adImpressions: 0,
        adClicks: 0
      }
    );

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
            events: providerEvents.length,
            upcomingEvents: providerEvents.filter((event) => Date.parse(event.startsAt) >= now).length,
            completedOrPastEvents: providerEvents.filter((event) => Date.parse(event.endsAt) < now).length,
            publishedEvents: providerEvents.filter((event) => event.status === "published").length,
            featuredEvents: providerEvents.filter((event) => event.status === "featured").length,
            rsvps: {
              total: totals.rsvps,
              confirmed: totals.confirmed,
              waitlisted: totals.waitlisted,
              canceled: totals.canceled,
              attended: totals.attended,
              noShow: totals.noShow
            },
            promotions: {
              total: totals.promotions,
              active: totals.activePromotions,
              budgetCents: totals.promotionBudgetCents
            },
            ads: {
              impressions: totals.adImpressions,
              clicks: totals.adClicks,
              clickThroughRate: totals.adImpressions > 0 ? Number((totals.adClicks / totals.adImpressions).toFixed(4)) : 0
            }
          },
          events: providerEvents.slice(0, 10).map((event) => ({
            id: event.id,
            slug: event.slug,
            title: event.title,
            eventType: event.eventType,
            status: event.status,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            city: event.city,
            state: event.state,
            isFree: event.isFree,
            capacity: event.capacity
          }))
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
            providerScopedEventsOnly: true,
            aggregateAnalyticsOnly: true,
            attendeeNamesExcluded: true,
            attendeeEmailsExcluded: true,
            attendeePhonesExcluded: true,
            consentPayloadsExcluded: true,
            perRsvpRowsExcluded: true
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
