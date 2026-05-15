import { campaignMetricKeys } from "@/lib/domain/campaigns";
import type {
  CampaignAssetRecord,
  CampaignMetricKey,
  CampaignMetricRecord,
  CampaignRecommendationActionInput,
  CampaignRecommendationActionRecord,
  CampaignRecommendationActionResult,
  CreateCampaignInput,
  MarketingCampaignRecord,
  ProviderCampaignOptimizationSummary,
  ProviderCampaignMetricsSummary,
  RecordCampaignMetricInput,
  RecordCampaignMetricResult
} from "@/lib/domain/campaigns";
import { recordAuditEvent } from "@/lib/audit-events";
import { featureForCampaignType, requireProviderFeature } from "@/lib/billing/entitlements";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedCampaigns: MarketingCampaignRecord[] = [];
const seedCampaignAssets: CampaignAssetRecord[] = [];
const seedCampaignMetrics: CampaignMetricRecord[] = [];
const seedCampaignRecommendationActions: CampaignRecommendationActionRecord[] = [];

export class CampaignMetricIngestionError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "CampaignMetricIngestionError";
    this.status = status;
  }
}

function isUuid(value?: string) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}

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

function mapCampaignAsset(row: Record<string, unknown>): CampaignAssetRecord {
  return {
    id: String(row.id),
    marketingCampaignId: String(row.marketing_campaign_id),
    assetType: String(row.asset_type),
    channel: String(row.channel),
    title: row.title ? String(row.title) : undefined,
    body: row.body ? String(row.body) : undefined,
    assetPayload:
      row.asset_payload && typeof row.asset_payload === "object" && !Array.isArray(row.asset_payload)
        ? (row.asset_payload as Record<string, unknown>)
        : {},
    approvalStatus: row.approval_status as CampaignAssetRecord["approvalStatus"]
  };
}

function mapCampaignMetric(row: Record<string, unknown>): CampaignMetricRecord {
  return {
    id: String(row.id),
    marketingCampaignId: String(row.marketing_campaign_id),
    metricKey: String(row.metric_key),
    metricValue: Number(row.metric_value ?? 0),
    metricPayload:
      row.metric_payload && typeof row.metric_payload === "object" && !Array.isArray(row.metric_payload)
        ? (row.metric_payload as Record<string, unknown>)
        : {},
    recordedAt: String(row.recorded_at)
  };
}

function mapCampaignRecommendationAction(row: Record<string, unknown>): CampaignRecommendationActionRecord {
  return {
    id: String(row.id),
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    recommendationId: String(row.recommendation_id),
    campaignId: row.campaign_id ? String(row.campaign_id) : undefined,
    actionType: row.action_type as CampaignRecommendationActionRecord["actionType"],
    status: row.status as CampaignRecommendationActionRecord["status"],
    priority: row.priority as CampaignRecommendationActionRecord["priority"],
    category: row.category as CampaignRecommendationActionRecord["category"],
    title: String(row.title),
    actionPayload:
      row.action_payload && typeof row.action_payload === "object" && !Array.isArray(row.action_payload)
        ? (row.action_payload as Record<string, unknown>)
        : {},
    dueAt: row.due_at ? String(row.due_at) : undefined,
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
  if (input.providerId) {
    await requireProviderFeature(input.providerId, featureForCampaignType(input.campaignType));
  }

  const policy = await runPolicyCheck({
    subjectType: "marketing_campaign",
    actionKey: `create_${input.campaignType}`,
    input
  });

  const status: MarketingCampaignRecord["status"] = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "draft";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const campaign = {
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
    seedCampaigns.unshift(campaign);
    return campaign;
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
    const { data, error } = await supabase
      .from("campaign_assets")
      .insert(
        assets.map((asset) => ({
          marketing_campaign_id: campaignId,
          asset_type: asset.assetType,
          channel: asset.channel,
          title: asset.title,
          body: asset.body,
          asset_payload: asset.assetPayload,
          approval_status: asset.approvalStatus
        }))
      )
      .select("*");

    if (error) {
      throw new Error(`Campaign asset generation failed: ${error.message}`);
    }

    return (data ?? []).map(mapCampaignAsset);
  } else {
    seedCampaignAssets.unshift(...assets);
  }

  return assets;
}

function assertMetricKey(metricKey: string): asserts metricKey is CampaignMetricKey {
  if (!campaignMetricKeys.includes(metricKey as CampaignMetricKey)) {
    throw new CampaignMetricIngestionError("metricKey must be impressions, clicks, leads, or conversions.");
  }
}

function normalizeMetricInput(input: RecordCampaignMetricInput): Required<RecordCampaignMetricInput> {
  if (!input.campaignId) {
    throw new CampaignMetricIngestionError("campaignId is required.");
  }

  assertMetricKey(input.metricKey);

  const metricValue = input.metricValue ?? 1;
  if (!Number.isFinite(metricValue) || metricValue <= 0 || metricValue > 100000) {
    throw new CampaignMetricIngestionError("metricValue must be greater than 0 and no more than 100000.");
  }

  const recordedAt = input.recordedAt ?? new Date().toISOString();
  if (Number.isNaN(new Date(recordedAt).getTime())) {
    throw new CampaignMetricIngestionError("recordedAt must be a valid ISO date when provided.");
  }

  return {
    campaignId: input.campaignId,
    metricKey: input.metricKey,
    metricValue,
    metricPayload: input.metricPayload ?? {},
    recordedAt
  };
}

export async function recordCampaignMetric(input: RecordCampaignMetricInput): Promise<RecordCampaignMetricResult> {
  const normalized = normalizeMetricInput(input);
  const campaign = (await listCampaigns()).find((item) => item.id === normalized.campaignId);

  if (!campaign) {
    throw new CampaignMetricIngestionError("Campaign not found.", 404);
  }

  const policy = await runPolicyCheck({
    subjectType: "campaign_metric",
    subjectId: normalized.campaignId,
    actionKey: `record_${normalized.metricKey}`,
    input: normalized
  });

  if (policy.decision.startsWith("blocked")) {
    throw new CampaignMetricIngestionError(policy.reasons[0] ?? "Campaign metric blocked by policy.", 403);
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const metric: CampaignMetricRecord = {
      id: `campaign-metric-${Date.now()}`,
      marketingCampaignId: normalized.campaignId,
      metricKey: normalized.metricKey,
      metricValue: normalized.metricValue,
      metricPayload: normalized.metricPayload,
      recordedAt: normalized.recordedAt
    };
    seedCampaignMetrics.unshift(metric);
    return { campaign, metric, policyDecision: policy.decision };
  }

  const { data, error } = await supabase
    .from("campaign_metrics")
    .insert({
      marketing_campaign_id: normalized.campaignId,
      metric_key: normalized.metricKey,
      metric_value: normalized.metricValue,
      metric_payload: normalized.metricPayload,
      recorded_at: normalized.recordedAt
    })
    .select("*")
    .single();

  if (error) {
    throw new CampaignMetricIngestionError(`Campaign metric ingest failed: ${error.message}`, 500);
  }

  return { campaign, metric: mapCampaignMetric(data), policyDecision: policy.decision };
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

function metricValue(metrics: CampaignMetricRecord[], key: string) {
  return metrics
    .filter((metric) => metric.metricKey === key)
    .reduce((total, metric) => total + metric.metricValue, 0);
}

function buildCampaignMetricActions(input: {
  campaigns: MarketingCampaignRecord[];
  assets: CampaignAssetRecord[];
  metrics: CampaignMetricRecord[];
}) {
  const actions: string[] = [];
  const published = input.campaigns.filter((campaign) => campaign.status === "published").length;
  const draftAssets = input.assets.filter((asset) => asset.approvalStatus === "draft").length;
  const leads = metricValue(input.metrics, "leads");

  if (input.campaigns.length === 0) {
    actions.push("Create a growth campaign before metrics can accumulate.");
  }

  if (input.campaigns.length > 0 && published === 0) {
    actions.push("Publish an approved campaign to start measurable growth activity.");
  }

  if (draftAssets > 0) {
    actions.push("Review generated campaign assets so approved creative can be published.");
  }

  if (published > 0 && leads === 0) {
    actions.push("Connect lead and conversion events so campaign ROI can be measured.");
  }

  if (!actions.length) {
    actions.push("Campaign metrics are ready for provider reporting and optimization review.");
  }

  return actions;
}

export async function getProviderCampaignMetrics(providerId?: string): Promise<ProviderCampaignMetricsSummary> {
  const campaigns = (await listCampaigns()).filter((campaign) => !providerId || campaign.providerId === providerId);
  const campaignIds = campaigns.map((campaign) => campaign.id);
  const supabase = getSupabaseAdminClient();
  let assets: CampaignAssetRecord[] = [];
  let metrics: CampaignMetricRecord[] = [];

  if (!campaignIds.length) {
    return {
      providerId,
      generatedAt: new Date().toISOString(),
      campaigns: { total: 0, draft: 0, published: 0, blocked: 0, completed: 0 },
      assets: { total: 0, approved: 0, draft: 0, blocked: 0 },
      metrics: { impressions: 0, clicks: 0, leads: 0, conversions: 0, clickThroughRate: 0 },
      campaignBreakdown: [],
      nextActions: buildCampaignMetricActions({ campaigns, assets, metrics })
    };
  }

  if (!supabase) {
    assets = seedCampaignAssets.filter((asset) => campaignIds.includes(asset.marketingCampaignId));
    metrics = seedCampaignMetrics.filter((metric) => campaignIds.includes(metric.marketingCampaignId));
  } else {
    const [assetResult, metricResult] = await Promise.all([
      supabase.from("campaign_assets").select("*").in("marketing_campaign_id", campaignIds),
      supabase.from("campaign_metrics").select("*").in("marketing_campaign_id", campaignIds)
    ]);

    if (assetResult.error) {
      throw new Error(`Campaign asset metrics query failed: ${assetResult.error.message}`);
    }

    if (metricResult.error) {
      throw new Error(`Campaign metrics query failed: ${metricResult.error.message}`);
    }

    assets = (assetResult.data ?? []).map(mapCampaignAsset);
    metrics = (metricResult.data ?? []).map(mapCampaignMetric);
  }

  const impressions = metricValue(metrics, "impressions");
  const clicks = metricValue(metrics, "clicks");

  return {
    providerId,
    generatedAt: new Date().toISOString(),
    campaigns: {
      total: campaigns.length,
      draft: campaigns.filter((campaign) => campaign.status === "draft").length,
      published: campaigns.filter((campaign) => campaign.status === "published").length,
      blocked: campaigns.filter((campaign) => campaign.status === "blocked_by_policy").length,
      completed: campaigns.filter((campaign) => campaign.status === "completed").length
    },
    assets: {
      total: assets.length,
      approved: assets.filter((asset) => asset.approvalStatus === "approved").length,
      draft: assets.filter((asset) => asset.approvalStatus === "draft").length,
      blocked: assets.filter((asset) => asset.approvalStatus === "blocked").length
    },
    metrics: {
      impressions,
      clicks,
      leads: metricValue(metrics, "leads"),
      conversions: metricValue(metrics, "conversions"),
      clickThroughRate: impressions > 0 ? Number((clicks / impressions).toFixed(4)) : 0
    },
    campaignBreakdown: campaigns.map((campaign) => ({
      campaign,
      assets: assets.filter((asset) => asset.marketingCampaignId === campaign.id).length,
      metrics: metrics.filter((metric) => metric.marketingCampaignId === campaign.id)
    })),
    nextActions: buildCampaignMetricActions({ campaigns, assets, metrics })
  };
}

function campaignRecommendationId(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function statusForRecommendationAction(actionType: CampaignRecommendationActionInput["actionType"]): CampaignRecommendationActionRecord["status"] {
  if (actionType === "dismiss") return "dismissed";
  if (actionType === "mark_reviewed") return "completed";
  return "queued";
}

function nextActionsForRecommendationAction(record: CampaignRecommendationActionRecord) {
  if (record.status === "blocked_by_policy") {
    return ["Resolve policy blockers before acting on this campaign recommendation."];
  }

  if (record.status === "dismissed") {
    return ["Keep the dismissal reason available for weekly growth review."];
  }

  if (record.status === "completed") {
    return ["Continue monitoring campaign metrics for follow-up recommendations."];
  }

  return [
    "Assign the queued recommendation to a provider growth owner.",
    "Record campaign metrics after execution so the optimization engine can evaluate impact."
  ];
}

async function persistCampaignRecommendationAction(
  record: Omit<CampaignRecommendationActionRecord, "id" | "createdAt">
): Promise<CampaignRecommendationActionRecord> {
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const action: CampaignRecommendationActionRecord = {
      ...record,
      id: `campaign-recommendation-action-${Date.now()}`,
      createdAt: now
    };
    seedCampaignRecommendationActions.unshift(action);
    return action;
  }

  const { data, error } = await supabase
    .from("campaign_recommendation_actions")
    .insert({
      provider_id: record.providerId,
      recommendation_id: record.recommendationId,
      campaign_id: record.campaignId,
      action_type: record.actionType,
      status: record.status,
      priority: record.priority,
      category: record.category,
      title: record.title,
      action_payload: record.actionPayload,
      due_at: record.dueAt
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Campaign recommendation action persistence failed: ${error.message}`);
  }

  return mapCampaignRecommendationAction(data);
}

export async function getProviderCampaignOptimizationRecommendations(
  providerId?: string
): Promise<ProviderCampaignOptimizationSummary> {
  const summary = await getProviderCampaignMetrics(providerId);
  const recommendations: ProviderCampaignOptimizationSummary["recommendations"] = [];

  if (summary.campaigns.total === 0) {
    recommendations.push({
      id: campaignRecommendationId(["campaign", providerId, "launch-growth-campaign"]),
      priority: "high",
      category: "launch",
      title: "Launch the first provider growth campaign",
      rationale: "No campaigns exist yet, so campaign performance cannot accumulate.",
      action: "Create a profile growth, local SEO, or event promotion campaign before optimizing traffic.",
      expectedImpact: "Creates the baseline needed for impressions, clicks, leads, and conversion tracking.",
      evidence: { campaignCount: summary.campaigns.total }
    });
  }

  if (summary.campaigns.total > 0 && summary.campaigns.published === 0) {
    recommendations.push({
      id: campaignRecommendationId(["campaign", providerId, "publish-approved-campaign"]),
      priority: "high",
      category: "launch",
      title: "Publish an approved campaign",
      rationale: "Campaigns exist but none are published, so family-facing traffic cannot be measured.",
      action: "Review generated assets, complete approvals, and publish the strongest campaign.",
      expectedImpact: "Moves campaign work from draft readiness into measurable family engagement.",
      evidence: { totalCampaigns: summary.campaigns.total, publishedCampaigns: summary.campaigns.published }
    });
  }

  if (summary.assets.draft > 0) {
    recommendations.push({
      id: campaignRecommendationId(["campaign", providerId, "approve-draft-assets"]),
      priority: "medium",
      category: "creative",
      title: "Approve or revise draft campaign assets",
      rationale: "Draft assets are waiting for review and cannot support reliable campaign growth until approved.",
      action: "Review draft social, SEO, and profile assets for senior-care accuracy, disclosures, and call-to-action clarity.",
      expectedImpact: "Improves launch readiness and reduces policy or brand delays before publishing.",
      evidence: { draftAssets: summary.assets.draft, totalAssets: summary.assets.total }
    });
  }

  if (summary.metrics.impressions > 0 && summary.metrics.clickThroughRate < 0.02) {
    recommendations.push({
      id: campaignRecommendationId(["campaign", providerId, "improve-click-through-rate"]),
      priority: "medium",
      category: "traffic",
      title: "Improve campaign click-through rate",
      rationale: "The campaign is earning impressions, but click-through rate is below the 2% optimization threshold.",
      action: "Test clearer care-type messaging, local trust signals, pricing-question language, and direct tour calls-to-action.",
      expectedImpact: "Converts existing visibility into more provider profile visits and family inquiries.",
      evidence: {
        impressions: summary.metrics.impressions,
        clicks: summary.metrics.clicks,
        clickThroughRate: summary.metrics.clickThroughRate
      }
    });
  }

  if (summary.metrics.clicks >= 10 && summary.metrics.leads === 0) {
    recommendations.push({
      id: campaignRecommendationId(["campaign", providerId, "connect-lead-capture"]),
      priority: "critical",
      category: "conversion",
      title: "Connect campaign traffic to lead capture",
      rationale: "Campaign clicks are present, but no lead events have been recorded.",
      action: "Verify inquiry forms, phone click tracking, tour request capture, and provider contact intent instrumentation.",
      expectedImpact: "Turns campaign traffic into measurable occupancy pipeline signals.",
      evidence: { clicks: summary.metrics.clicks, leads: summary.metrics.leads }
    });
  }

  if (summary.metrics.leads > 0 && summary.metrics.conversions === 0) {
    recommendations.push({
      id: campaignRecommendationId(["campaign", providerId, "track-conversions"]),
      priority: "medium",
      category: "measurement",
      title: "Track downstream tour and conversion outcomes",
      rationale: "Lead events exist, but conversion events have not been recorded.",
      action: "Record tour scheduled, tour completed, and move-in milestone events against the campaign.",
      expectedImpact: "Connects marketing performance to admissions and occupancy reporting.",
      evidence: { leads: summary.metrics.leads, conversions: summary.metrics.conversions }
    });
  }

  if (summary.metrics.impressions === 0 && summary.campaigns.published > 0) {
    recommendations.push({
      id: campaignRecommendationId(["campaign", providerId, "verify-distribution"]),
      priority: "high",
      category: "measurement",
      title: "Verify campaign distribution and impression tracking",
      rationale: "Published campaigns exist, but no impressions have been recorded.",
      action: "Confirm the campaign is placed on public surfaces and that impression events are being posted.",
      expectedImpact: "Confirms whether the campaign has a traffic problem or an instrumentation problem.",
      evidence: { publishedCampaigns: summary.campaigns.published, impressions: summary.metrics.impressions }
    });
  }

  if (!recommendations.length) {
    recommendations.push({
      id: campaignRecommendationId(["campaign", providerId, "continue-optimization-review"]),
      priority: "low",
      category: "measurement",
      title: "Continue weekly campaign optimization review",
      rationale: "Campaign metrics are flowing and no critical growth blockers were detected.",
      action: "Review CTR, lead rate, conversion rate, and asset approvals weekly before changing spend or creative.",
      expectedImpact: "Keeps campaign decisions tied to actual family engagement data.",
      evidence: summary.metrics
    });
  }

  return {
    providerId,
    generatedAt: new Date().toISOString(),
    metrics: summary.metrics,
    campaignCount: summary.campaigns.total,
    recommendationCount: recommendations.length,
    recommendations
  };
}

export async function actOnCampaignOptimizationRecommendation(
  input: CampaignRecommendationActionInput
): Promise<CampaignRecommendationActionResult> {
  if (!input.recommendationId) {
    throw new Error("recommendationId is required");
  }

  if (!["create_task", "queue_internal", "mark_reviewed", "dismiss"].includes(input.actionType)) {
    throw new Error("actionType must be create_task, queue_internal, mark_reviewed, or dismiss");
  }

  if (input.dueAt && Number.isNaN(new Date(input.dueAt).getTime())) {
    throw new Error("dueAt must be a valid ISO date when provided");
  }

  const summary = await getProviderCampaignOptimizationRecommendations(input.providerId);
  const recommendation = summary.recommendations.find((item) => item.id === input.recommendationId);

  if (!recommendation) {
    throw new Error("Campaign recommendation not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "campaign_recommendation",
    subjectId: isUuid(recommendation.campaignId) ? recommendation.campaignId : undefined,
    actionKey: `campaign_recommendation_${input.actionType}`,
    input: {
      providerId: input.providerId,
      recommendationId: input.recommendationId,
      actionType: input.actionType,
      title: recommendation.title,
      action: recommendation.action,
      notes: input.notes
    }
  });
  const blocked = policy.decision === "blocked" || policy.decision === "blocked_non_overridable";
  const status = blocked ? "blocked_by_policy" : statusForRecommendationAction(input.actionType);
  const action = await persistCampaignRecommendationAction({
    providerId: input.providerId,
    recommendationId: recommendation.id,
    campaignId: recommendation.campaignId,
    actionType: input.actionType,
    status,
    priority: recommendation.priority,
    category: recommendation.category,
    title: recommendation.title,
    dueAt: input.dueAt,
    actionPayload: {
      title: recommendation.title,
      rationale: recommendation.rationale,
      action: recommendation.action,
      expectedImpact: recommendation.expectedImpact,
      evidence: recommendation.evidence,
      notes: input.notes,
      policyDecision: policy.decision,
      policyReasons: policy.reasons,
      queuedTarget: input.actionType === "queue_internal" ? "audit_events:campaign_recommendation_queue" : undefined
    }
  });

  await recordAuditEvent({
    actorId: input.actorId,
    actorType: input.actorId ? "provider" : "system",
    eventType: "campaign_recommendation.action_recorded",
    subjectType: "campaign_recommendation",
    subjectId: action.id,
    payload: {
      providerId: input.providerId,
      recommendationId: recommendation.id,
      actionType: input.actionType,
      status,
      priority: recommendation.priority,
      category: recommendation.category,
      policyDecision: policy.decision
    }
  });

  return {
    recommendation,
    action,
    policyDecision: policy.decision,
    nextActions: nextActionsForRecommendationAction(action)
  };
}
