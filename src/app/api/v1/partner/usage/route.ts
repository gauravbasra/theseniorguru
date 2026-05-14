import { NextResponse } from "next/server";
import { authenticatePartnerApiRequest, exportApiUsageAnalytics, getApiUsageAnalytics } from "@/lib/openapi/platform";
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
    const input = {
      apiClientId: auth.client.id,
      windowDays: Number.isFinite(windowDays) ? windowDays : 30
    };
    const headers = partnerSuccessHeaders(auth);

    if (searchParams.get("format") === "csv") {
      const exportPayload = await exportApiUsageAnalytics(input);

      return new NextResponse(exportPayload.csv, {
        headers: {
          ...headers,
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json(
      {
        data: await getApiUsageAnalytics(input),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode
        }
      },
      { headers }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
