import { NextResponse } from "next/server";
import { authenticatePartnerApiRequest, getApiUsageAnalytics } from "@/lib/openapi/platform";
import { partnerAuthErrorResponse, partnerSuccessHeaders } from "@/lib/openapi/responses";

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "usage:read", {
      eventType: "partner.usage.summary",
      subjectType: "api_usage"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const windowDays = Number(searchParams.get("windowDays") ?? 30);

    return NextResponse.json(
      {
        data: await getApiUsageAnalytics({
          apiClientId: auth.client.id,
          windowDays: Number.isFinite(windowDays) ? windowDays : 30
        }),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
