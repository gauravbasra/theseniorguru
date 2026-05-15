import { NextResponse } from "next/server";
import { getEventAnalytics } from "@/lib/events/event-analytics";
import { getEventById } from "@/lib/events/events";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const event = await getEventById(id);
    const auth = await authenticatePartnerApiRequest(request, "events:read", {
      eventType: "partner.events.analytics",
      subjectType: "events",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const analytics = await getEventAnalytics(event.id);

    return NextResponse.json(
      {
        data: {
          event: {
            id: event.id,
            slug: event.slug,
            title: event.title,
            status: event.status,
            startsAt: event.startsAt,
            endsAt: event.endsAt,
            city: event.city,
            state: event.state
          },
          analytics
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          contentRules: {
            aggregationOnly: true,
            attendeeNamesExcluded: true,
            attendeeEmailsExcluded: true,
            attendeePhonesExcluded: true,
            consentPayloadsExcluded: true
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
