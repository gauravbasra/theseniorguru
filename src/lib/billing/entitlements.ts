import { listProviderFeatureEntitlements } from "@/lib/billing/growth-subscriptions";

const freeFeatures = new Set(["baseline_chat", "free_listing", "direct_contact"]);

export type ProviderFeatureCheckResult = {
  providerId: string;
  featureKey: string;
  allowed: boolean;
  reason: "free_feature" | "active_entitlement" | "missing_entitlement";
};

export function featureForCampaignType(campaignType: string) {
  if (campaignType === "review_request") return "reviews";
  if (campaignType === "event_promotion") return "event_promotions";
  if (campaignType === "ai_chat") return "enhanced_chat";
  if (campaignType === "ai_voice") return "ai_voice";
  if (campaignType === "local_seo") return "ai_seo";
  if (campaignType === "social_media") return "ai_social";
  return "campaigns";
}

export async function checkProviderFeature(providerId: string, featureKey: string): Promise<ProviderFeatureCheckResult> {
  if (freeFeatures.has(featureKey)) {
    return {
      providerId,
      featureKey,
      allowed: true,
      reason: "free_feature"
    };
  }

  const entitlements = await listProviderFeatureEntitlements(providerId);
  const allowed = entitlements.some((entitlement) => entitlement.featureKey === featureKey && entitlement.status === "active");

  return {
    providerId,
    featureKey,
    allowed,
    reason: allowed ? "active_entitlement" : "missing_entitlement"
  };
}

export async function requireProviderFeature(providerId: string, featureKey: string) {
  const check = await checkProviderFeature(providerId, featureKey);

  if (!check.allowed) {
    throw new Error(`Provider feature '${featureKey}' requires an active growth subscription.`);
  }

  return check;
}

