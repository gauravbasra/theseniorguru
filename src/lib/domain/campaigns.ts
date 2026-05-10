export type MarketingCampaignType =
  | "profile_growth"
  | "event_promotion"
  | "review_request"
  | "local_seo"
  | "social_media"
  | "ai_chat"
  | "ai_voice"
  | "newsletter"
  | "sponsored_content";

export type MarketingCampaignStatus =
  | "draft"
  | "generated"
  | "pending_approval"
  | "approved"
  | "published"
  | "paused"
  | "completed"
  | "blocked_by_policy";

export type MarketingCampaignRecord = {
  id: string;
  providerId?: string;
  campaignType: MarketingCampaignType;
  status: MarketingCampaignStatus;
  name: string;
  objective?: string;
  audience: Record<string, unknown>;
  channels: string[];
  startsAt?: string;
  endsAt?: string;
  createdAt: string;
};

export type CreateCampaignInput = {
  providerId?: string;
  campaignType: MarketingCampaignType;
  name: string;
  objective?: string;
  audience?: Record<string, unknown>;
  channels?: string[];
  startsAt?: string;
  endsAt?: string;
};

export type CampaignAssetRecord = {
  id: string;
  marketingCampaignId: string;
  assetType: string;
  channel: string;
  title?: string;
  body?: string;
  assetPayload: Record<string, unknown>;
  approvalStatus: "draft" | "approved" | "rejected" | "blocked";
};

