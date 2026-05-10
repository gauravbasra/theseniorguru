import { NextResponse } from "next/server";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import { partnerAuthErrorResponse } from "@/lib/openapi/responses";
import { listProviders } from "@/lib/providers";

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "providers:read", {
      eventType: "partner.providers.list",
      subjectType: "providers"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const providers = await listProviders();

    return NextResponse.json({
      data: providers,
      meta: {
        apiClientId: auth.client.id,
        sandboxMode: auth.client.sandboxMode,
        count: providers.length
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
