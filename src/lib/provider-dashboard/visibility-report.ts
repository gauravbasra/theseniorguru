import { listProviderFeatureEntitlements } from "@/lib/billing/growth-subscriptions";
import { listCampaigns } from "@/lib/campaigns/campaigns";
import { listProviderClaims } from "@/lib/claims/provider-claims";
import type { ProviderClaimRecord } from "@/lib/domain/claims";
import type { ProviderRecord } from "@/lib/domain/providers";
import { listEvents } from "@/lib/events/events";
import { getProviderById } from "@/lib/providers";
import { listProviderReviewPipeline } from "@/lib/reviews/reviews";

type VisibilityReportAction = {
  label: string;
  priority: "high" | "medium" | "low";
  reason: string;
  href: string;
};

type VisibilityMetric = {
  label: string;
  value: number;
  total: number;
  status: "strong" | "watch" | "gap";
};

export type ProviderVisibilityReport = {
  providerId: string;
  providerName: string;
  generatedAt: string;
  profileCompletionScore: number;
  discoveryScore: number;
  reputationScore: number;
  growthReadinessScore: number;
  overallScore: number;
  claimStatus: ProviderClaimRecord["status"] | "not_claimed";
  metrics: VisibilityMetric[];
  missingProfileFields: string[];
  activeEntitlements: string[];
  nextBestActions: VisibilityReportAction[];
};

const profileChecks: Array<{
  key: string;
  label: string;
  passed: (provider: ProviderRecord) => boolean;
}> = [
  { key: "address", label: "Complete address", passed: (provider) => Boolean(provider.address && provider.city && provider.state) },
  { key: "phone", label: "Direct phone", passed: (provider) => Boolean(provider.phone) },
  { key: "websiteUrl", label: "Website link", passed: (provider) => Boolean(provider.websiteUrl) },
  { key: "imageUrl", label: "Profile image", passed: (provider) => Boolean(provider.imageUrl) },
  { key: "summary", label: "Family-facing summary", passed: (provider) => Boolean(provider.summary && provider.summary.length >= 80) },
  { key: "categories", label: "Care categories", passed: (provider) => provider.categories.length > 0 },
  { key: "source", label: "Source provenance", passed: (provider) => Boolean(provider.source.url && provider.source.fetchedAt) }
];

function percent(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
}

function metricStatus(value: number, total: number): VisibilityMetric["status"] {
  const score = percent(value, total);
  if (score >= 80) return "strong";
  if (score >= 45) return "watch";
  return "gap";
}

export async function getProviderVisibilityReport(providerId: string): Promise<ProviderVisibilityReport> {
  const provider = await getProviderById(providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const [claims, events, campaigns, reviews, entitlements] = await Promise.all([
    listProviderClaims(),
    listEvents(),
    listCampaigns(),
    listProviderReviewPipeline(provider.id),
    listProviderFeatureEntitlements(provider.id)
  ]);
  const providerClaims = claims.filter((claim) => claim.providerId === provider.id);
  const providerEvents = events.filter((event) => event.providerId === provider.id);
  const providerCampaigns = campaigns.filter((campaign) => campaign.providerId === provider.id);
  const publishedReviews = reviews.filter((review) => review.status === "published");
  const pendingReviews = reviews.filter((review) => review.status === "pending_moderation");
  const activeEntitlements = entitlements
    .filter((entitlement) => entitlement.status === "active")
    .map((entitlement) => entitlement.featureKey);
  const passedProfileChecks = profileChecks.filter((check) => check.passed(provider));
  const missingProfileFields = profileChecks
    .filter((check) => !check.passed(provider))
    .map((check) => check.label);
  const claimStatus = providerClaims[0]?.status ?? "not_claimed";
  const profileCompletionScore = percent(passedProfileChecks.length, profileChecks.length);
  const discoverySignals = [
    provider.status !== "imported",
    provider.confidenceScore >= 0.85,
    Boolean(provider.source.url),
    providerEvents.some((event) => ["published", "featured"].includes(event.status))
  ].filter(Boolean).length;
  const discoveryScore = percent(discoverySignals, 4);
  const reputationSignals = [
    publishedReviews.length > 0,
    pendingReviews.length === 0,
    reviews.length >= 3
  ].filter(Boolean).length;
  const reputationScore = percent(reputationSignals, 3);
  const growthSignals = [
    claimStatus === "approved",
    providerCampaigns.length > 0,
    activeEntitlements.length > 0,
    providerEvents.length > 0
  ].filter(Boolean).length;
  const growthReadinessScore = percent(growthSignals, 4);
  const nextBestActions: VisibilityReportAction[] = [];

  if (claimStatus !== "approved") {
    nextBestActions.push({
      label: "Finish claim verification",
      priority: "high",
      reason: "Claimed and verified profiles can update public content and unlock stronger operator analytics.",
      href: "/provider"
    });
  }

  if (missingProfileFields.length) {
    nextBestActions.push({
      label: "Complete listing profile",
      priority: "high",
      reason: `${missingProfileFields.slice(0, 3).join(", ")} still affect family trust and search quality.`,
      href: `/api/v1/provider-portal/providers/${provider.id}`
    });
  }

  if (!publishedReviews.length) {
    nextBestActions.push({
      label: "Start review collection",
      priority: "medium",
      reason: "Families compare trust signals before they call, tour, or save a provider.",
      href: "/operators/reputation"
    });
  }

  if (!providerEvents.length) {
    nextBestActions.push({
      label: "Publish a local event",
      priority: "medium",
      reason: "Events create local community value and sponsored promotion inventory.",
      href: "/api/v1/provider/events"
    });
  }

  if (!providerCampaigns.length) {
    nextBestActions.push({
      label: "Launch local SEO campaign",
      priority: "low",
      reason: "Campaigns turn a free listing into an occupancy growth path.",
      href: "/api/v1/provider/campaigns"
    });
  }

  return {
    providerId: provider.id,
    providerName: provider.name,
    generatedAt: new Date().toISOString(),
    profileCompletionScore,
    discoveryScore,
    reputationScore,
    growthReadinessScore,
    overallScore: Math.round((profileCompletionScore + discoveryScore + reputationScore + growthReadinessScore) / 4),
    claimStatus,
    metrics: [
      {
        label: "Profile completion",
        value: passedProfileChecks.length,
        total: profileChecks.length,
        status: metricStatus(passedProfileChecks.length, profileChecks.length)
      },
      {
        label: "Discovery signals",
        value: discoverySignals,
        total: 4,
        status: metricStatus(discoverySignals, 4)
      },
      {
        label: "Reputation signals",
        value: reputationSignals,
        total: 3,
        status: metricStatus(reputationSignals, 3)
      },
      {
        label: "Growth readiness",
        value: growthSignals,
        total: 4,
        status: metricStatus(growthSignals, 4)
      }
    ],
    missingProfileFields,
    activeEntitlements,
    nextBestActions: nextBestActions.slice(0, 5)
  };
}
