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

export type CampaignMetricRecord = {
  id: string;
  marketingCampaignId: string;
  metricKey: string;
  metricValue: number;
  metricPayload: Record<string, unknown>;
  recordedAt: string;
};

export const campaignMetricKeys = ["impressions", "clicks", "leads", "conversions"] as const;

export type CampaignMetricKey = (typeof campaignMetricKeys)[number];

export type RecordCampaignMetricInput = {
  campaignId: string;
  metricKey: CampaignMetricKey;
  metricValue?: number;
  metricPayload?: Record<string, unknown>;
  recordedAt?: string;
};

export type RecordCampaignMetricResult = {
  campaign: MarketingCampaignRecord;
  metric: CampaignMetricRecord;
  policyDecision: string;
};

export type ProviderCampaignMetricsSummary = {
  providerId?: string;
  generatedAt: string;
  campaigns: {
    total: number;
    draft: number;
    published: number;
    blocked: number;
    completed: number;
  };
  assets: {
    total: number;
    approved: number;
    draft: number;
    blocked: number;
  };
  metrics: {
    impressions: number;
    clicks: number;
    leads: number;
    conversions: number;
    clickThroughRate: number;
  };
  campaignBreakdown: Array<{
    campaign: MarketingCampaignRecord;
    assets: number;
    metrics: CampaignMetricRecord[];
  }>;
  nextActions: string[];
};

export type CampaignOptimizationRecommendation = {
  id: string;
  campaignId?: string;
  priority: "critical" | "high" | "medium" | "low";
  category: "launch" | "creative" | "traffic" | "conversion" | "measurement";
  title: string;
  rationale: string;
  action: string;
  expectedImpact: string;
  evidence: Record<string, unknown>;
};

export type ProviderCampaignOptimizationSummary = {
  providerId?: string;
  generatedAt: string;
  metrics: ProviderCampaignMetricsSummary["metrics"];
  campaignCount: number;
  recommendationCount: number;
  recommendations: CampaignOptimizationRecommendation[];
};

export type VoiceAssistantProvider = "manual_export" | "internal_notification_queue" | "twilio" | "retell" | "elevenlabs";

export type VoiceAssistantStatus = "preview" | "queued" | "configured" | "blocked_by_policy" | "failed";

export type VoiceAssistantChannelReadiness = {
  provider: VoiceAssistantProvider;
  status: "ready" | "blocked";
  blockers: string[];
  evidence: Record<string, unknown>;
};

export type VoiceAssistantReadiness = {
  providerId?: string;
  providerName?: string;
  generatedAt: string;
  entitlement: {
    featureKey: "ai_voice";
    allowed: boolean;
    reason: string;
  };
  channels: VoiceAssistantChannelReadiness[];
  recommendedProvider: VoiceAssistantProvider;
  blockers: string[];
  nextActions: string[];
};

export type VoiceAssistantPreviewInput = {
  providerId: string;
  assistantName?: string;
  phoneNumber?: string;
  transferNumber?: string;
  greeting?: string;
  missedCallPolicy?: "capture_callback" | "route_to_staff" | "send_sms_followup";
  deliveryProvider?: VoiceAssistantProvider;
  dryRun?: boolean;
  actorId?: string;
};

export type VoiceAssistantCampaignRecord = {
  id: string;
  providerId: string;
  assistantName: string;
  status: VoiceAssistantStatus;
  deliveryProvider: VoiceAssistantProvider;
  phoneNumber?: string;
  transferNumber?: string;
  greeting: string;
  missedCallPolicy: VoiceAssistantPreviewInput["missedCallPolicy"];
  readinessPayload: Record<string, unknown>;
  createdAt: string;
};

export type VoiceAssistantPreviewResult = {
  dryRun: boolean;
  status: VoiceAssistantStatus;
  deliveryProvider: VoiceAssistantProvider;
  readiness: VoiceAssistantReadiness;
  campaign: VoiceAssistantCampaignRecord;
  payload: Record<string, unknown>;
  blockers: string[];
  nextActions: string[];
};
