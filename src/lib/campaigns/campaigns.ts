import type { CampaignAssetRecord, CreateCampaignInput, MarketingCampaignRecord } from "@/lib/domain/campaigns";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedCampaigns: MarketingCampaignRecord[] = [];

function mapCampaign(row: Record<string, unknown>): MarketingCampaignRecord {
  return {
    id: String(row.id),
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    campaignType: row.campaign_type as MarketingCampaignRecord["campaignType"],
    status: row.status as MarketingCampaignRecord["status"],
    name: String(row.name),
    objective: row.objective ? String(row.objective) : undefined,
    audience: (row.audience as Record<string, unknown>) ?? {},
    channels: Array.isArray(row.channels) ? row.channels.map(String) : [],
    startsAt: row.starts_at ? String(row.starts_at) : undefined,
    endsAt: row.ends_at ? String(row.ends_at) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listCampaigns(): Promise<MarketingCampaignRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCampaigns;
  }

  const { data, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Campaign query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCampaign);
}

export async function createCampaign(input: CreateCampaignInput): Promise<MarketingCampaignRecord> {
  const policy = await runPolicyCheck({
    subjectType: "marketing_campaign",
    actionKey: `create_${input.campaignType}`,
    input
  });

  const status = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "draft";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-campaign-${Date.now()}`,
      providerId: input.providerId,
      campaignType: input.campaignType,
      status,
      name: input.name,
      objective: input.objective,
      audience: input.audience ?? {},
      channels: input.channels ?? [],
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("marketing_campaigns")
    .insert({
      provider_id: input.providerId,
      campaign_type: input.campaignType,
      status,
      name: input.name,
      objective: input.objective,
      audience: input.audience ?? {},
      channels: input.channels ?? [],
      starts_at: input.startsAt,
      ends_at: input.endsAt
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Campaign creation failed: ${error.message}`);
  }

  return mapCampaign(data);
}

export async function generateCampaignAssets(campaignId: string): Promise<CampaignAssetRecord[]> {
  const assets: CampaignAssetRecord[] = [
    {
      id: `generated-social-${Date.now()}`,
      marketingCampaignId: campaignId,
      assetType: "social_post",
      channel: "social",
      title: "Helpful local senior care guidance",
      body: "Families deserve clear options, local events, and direct provider contact without referral pressure.",
      assetPayload: { generatedBy: "campaign-generator-v1" },
      approvalStatus: "draft"
    },
    {
      id: `generated-seo-${Date.now()}`,
      marketingCampaignId: campaignId,
      assetType: "seo_brief",
      channel: "seo",
      title: "Local senior services visibility brief",
      body: "Build a city/category page with verified services, event links, reviews, and disclosure-safe sponsored modules.",
      assetPayload: { generatedBy: "campaign-generator-v1" },
      approvalStatus: "draft"
    }
  ];

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    await supabase.from("campaign_assets").insert(
      assets.map((asset) => ({
        marketing_campaign_id: campaignId,
        asset_type: asset.assetType,
        channel: asset.channel,
        title: asset.title,
        body: asset.body,
        asset_payload: asset.assetPayload,
        approval_status: asset.approvalStatus
      }))
    );
  }

  return assets;
}

export async function publishCampaign(campaignId: string) {
  const policy = await runPolicyCheck({
    subjectType: "marketing_campaign",
    subjectId: campaignId,
    actionKey: "publish_campaign",
    input: { campaignId }
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Campaign blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    await supabase.from("marketing_campaigns").update({ status: "published" }).eq("id", campaignId);
  }

  return { id: campaignId, status: "published" };
}

