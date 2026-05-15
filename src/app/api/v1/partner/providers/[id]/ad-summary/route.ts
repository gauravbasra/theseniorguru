import { NextResponse } from "next/server";
import { getProviderAdCampaignDashboard } from "@/lib/ads/ads";
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
    const auth = await authenticatePartnerApiRequest(request, "ads:read", {
      eventType: "partner.providers.ad_summary",
      subjectType: "ad_reporting",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const { searchParams } = new URL(request.url);
    const dashboard = await getProviderAdCampaignDashboard({
      providerId: provider.id,
      placementKey: searchParams.get("placementKey") ?? undefined,
      from: searchParams.get("from") ?? undefined,
      to: searchParams.get("to") ?? undefined
    });

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
          generatedAt: dashboard.generatedAt,
          status: dashboard.status,
          filters: dashboard.filters,
          totals: dashboard.totals,
          health: dashboard.health,
          placements: dashboard.placements,
          recommendations: dashboard.recommendations
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
            aggregateReportingOnly: true,
            providerScopedCreativesOnly: true,
            rawCreativePayloadExcluded: true,
            creativeBodyExcluded: true,
            destinationUrlsExcluded: true,
            visitorContextExcluded: true,
            requestIdsExcluded: true,
            impressionClickRowsExcluded: true
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
