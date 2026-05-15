import { NextResponse } from "next/server";
import { getAdPlacementForContext, listAdPlacements } from "@/lib/ads/ads";
import {
  applyPartnerPagination,
  partnerAuthErrorResponse,
  partnerPaginationFromRequest,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";

function truthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "ads:read", {
      eventType: "partner.ads.placements.list",
      subjectType: "ad_placements"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      placementKey: searchParams.get("placementKey") ?? undefined,
      surface: searchParams.get("surface") ?? undefined,
      activeOnly: searchParams.get("activeOnly") === "false" ? false : true,
      includeCreatives: truthy(searchParams.get("includeCreatives")),
      visitorKey: searchParams.get("visitorKey") ?? undefined,
      sessionKey: searchParams.get("sessionKey") ?? undefined
    };
    const placements = (await listAdPlacements())
      .filter((placement) => !filters.placementKey || placement.placementKey === filters.placementKey)
      .filter((placement) => !filters.surface || placement.surface === filters.surface)
      .filter((placement) => !filters.activeOnly || placement.isActive);
    const placementResponses = filters.includeCreatives
      ? await Promise.all(
          placements.map(async (placement) => ({
            ...placement,
            deliveryPreview: await getAdPlacementForContext(placement.placementKey, {
              visitorKey: filters.visitorKey,
              sessionKey: filters.sessionKey
            })
          }))
        )
      : placements;
    const pagination = partnerPaginationFromRequest(request, placementResponses.length);

    return NextResponse.json(
      {
        data: applyPartnerPagination(placementResponses, pagination),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: placementResponses.length,
          filters,
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
