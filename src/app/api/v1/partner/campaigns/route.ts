import { NextResponse } from "next/server";
import type { MarketingCampaignRecord } from "@/lib/domain/campaigns";
import { getProviderCampaignMetrics, listCampaigns } from "@/lib/campaigns/campaigns";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  applyPartnerPagination,
  partnerAuthErrorResponse,
  partnerPaginationFromRequest,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

const partnerCampaignTypes: MarketingCampaignRecord["campaignType"][] = [
  "profile_growth",
  "event_promotion",
  "review_request",
  "local_seo",
  "social_media",
  "ai_chat",
  "ai_voice",
  "newsletter",
  "sponsored_content"
];
const partnerCampaignStatuses: MarketingCampaignRecord["status"][] = [
  "draft",
  "generated",
  "pending_approval",
  "approved",
  "published",
  "paused",
  "completed"
];

function truthy(value: string | null) {
  return value === "1" || value === "true" || value === "yes";
}

function campaignTypeFromRequest(value: string | null) {
  return partnerCampaignTypes.includes(value as MarketingCampaignRecord["campaignType"])
    ? (value as MarketingCampaignRecord["campaignType"])
    : undefined;
}

function campaignStatusFromRequest(value: string | null) {
  return partnerCampaignStatuses.includes(value as MarketingCampaignRecord["status"])
    ? (value as MarketingCampaignRecord["status"])
    : undefined;
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "campaigns:read", {
      eventType: "partner.campaigns.list",
      subjectType: "marketing_campaigns"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      providerId: searchParams.get("providerId") ?? undefined,
      campaignType: campaignTypeFromRequest(searchParams.get("campaignType")),
      status: campaignStatusFromRequest(searchParams.get("status")) ?? "published",
      includeMetrics: truthy(searchParams.get("includeMetrics"))
    };
    const campaigns = (await listCampaigns())
      .filter((campaign) => !filters.providerId || campaign.providerId === filters.providerId)
      .filter((campaign) => !filters.campaignType || campaign.campaignType === filters.campaignType)
      .filter((campaign) => campaign.status !== "blocked_by_policy")
      .filter((campaign) => campaign.status === filters.status);
    const pagination = partnerPaginationFromRequest(request, campaigns.length);
    const metrics = filters.includeMetrics ? await getProviderCampaignMetrics(filters.providerId) : undefined;

    return NextResponse.json(
      {
        data: applyPartnerPagination(campaigns, pagination),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: campaigns.length,
          filters,
          pagination,
          metrics,
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
