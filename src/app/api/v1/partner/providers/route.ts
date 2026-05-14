import { NextResponse } from "next/server";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  applyPartnerPagination,
  partnerAuthErrorResponse,
  partnerPaginationFromRequest,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";
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
    const pagination = partnerPaginationFromRequest(request, providers.length);

    return NextResponse.json(
      {
        data: applyPartnerPagination(providers, pagination),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: providers.length,
          pagination,
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
