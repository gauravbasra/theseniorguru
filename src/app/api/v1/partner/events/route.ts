import { NextResponse } from "next/server";
import { listEvents } from "@/lib/events/events";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import { partnerAuthErrorResponse, partnerResponseEnvelopeMeta, partnerSuccessHeaders } from "@/lib/openapi/responses";

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "events:read", {
      eventType: "partner.events.list",
      subjectType: "events"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const events = await listEvents();

    return NextResponse.json(
      {
        data: events,
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: events.length,
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
