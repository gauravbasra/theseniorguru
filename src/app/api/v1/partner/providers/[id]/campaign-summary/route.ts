import { NextResponse } from "next/server";
import { getProviderCampaignMetrics } from "@/lib/campaigns/campaigns";
import type { MarketingCampaignRecord } from "@/lib/domain/campaigns";
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

function publicCampaignReference(campaign: MarketingCampaignRecord, assets: number, metrics: number) {
  return {
    id: campaign.id,
    campaignType: campaign.campaignType,
    status: campaign.status,
    name: campaign.name,
    objective: campaign.objective,
    channels: campaign.channels,
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    createdAt: campaign.createdAt,
    assetCount: assets,
    metricCount: metrics
  };
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "campaigns:read", {
      eventType: "partner.providers.campaign_summary",
      subjectType: "marketing_campaigns",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const metrics = await getProviderCampaignMetrics(provider.id);
    const campaigns = metrics.campaignBreakdown.map((item) => item.campaign);

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
          generatedAt: metrics.generatedAt,
          campaigns: metrics.campaigns,
          assets: metrics.assets,
          metrics: metrics.metrics,
          distributions: {
            byType: countBy(campaigns, (campaign) => campaign.campaignType),
            byStatus: countBy(campaigns, (campaign) => campaign.status),
            byChannel: countBy(
              campaigns.flatMap((campaign) => campaign.channels),
              (channel) => channel
            )
          },
          recentCampaigns: metrics.campaignBreakdown.slice(0, 10).map((item) =>
            publicCampaignReference(item.campaign, item.assets, item.metrics.length)
          ),
          nextActions: metrics.nextActions
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
            providerScopedCampaignsOnly: true,
            aggregateMetricsOnly: true,
            blockedCampaignContentExcluded: true,
            campaignAudiencePayloadExcluded: true,
            assetBodyExcluded: true,
            assetPayloadExcluded: true,
            metricPayloadExcluded: true,
            rowLevelMetricRecordsExcluded: true
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
