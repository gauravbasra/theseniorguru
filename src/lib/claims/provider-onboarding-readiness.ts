import type { ProviderClaimRecord, ProviderOnboardingReadinessSummary } from "@/lib/domain/claims";
import { listProviderClaims } from "@/lib/claims/provider-claims";
import { getProviderClaimStatusSummary } from "@/lib/claims/claim-status";
import { listProviderVerificationAttempts } from "@/lib/claims/provider-verification";
import { listProviderOutreach } from "@/lib/outreach/provider-outreach";
import { getProviderById } from "@/lib/providers";
import {
  listProviderFeatureEntitlements,
  listProviderGrowthSubscriptions
} from "@/lib/billing/growth-subscriptions";
import { getProviderReputationReadiness } from "@/lib/reviews/reputation-readiness";

function latestClaim(claims: ProviderClaimRecord[]) {
  return [...claims].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

export async function getProviderOnboardingReadiness(providerId: string): Promise<ProviderOnboardingReadinessSummary> {
  const provider = await getProviderById(providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const [claims, outreach, reputation, subscriptions, entitlements] = await Promise.all([
    listProviderClaims(),
    listProviderOutreach("all"),
    getProviderReputationReadiness(provider.id),
    listProviderGrowthSubscriptions(provider.id),
    listProviderFeatureEntitlements(provider.id)
  ]);
  const providerClaims = claims.filter((claim) => claim.providerId === provider.id);
  const claim = latestClaim(providerClaims);
  const claimStatus = claim ? await getProviderClaimStatusSummary(claim.id) : undefined;
  const verificationAttempts = claim ? await listProviderVerificationAttempts(claim.id) : [];
  const providerOutreach = outreach.filter((item) => item.providerId === provider.id);
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "active");
  const pendingSubscriptions = subscriptions.filter((subscription) => subscription.status === "pending_contract");
  const blockedSubscriptions = subscriptions.filter((subscription) => subscription.status === "blocked_by_policy");
  const blockers: string[] = [];

  if (!providerOutreach.length && !providerClaims.length) {
    blockers.push("Provider has not been invited to claim the free listing.");
  }

  if (!claim) {
    blockers.push("Provider claim has not been submitted.");
  } else if (!claimStatus?.canEditProfile) {
    blockers.push(claimStatus?.nextAction ?? "Provider claim is not approved yet.");
  }

  if (reputation.status !== "ready") {
    blockers.push(...reputation.blockers);
  }

  if (!activeSubscriptions.length) {
    blockers.push(
      pendingSubscriptions.length
        ? "Growth subscription is waiting on contract activation."
        : "No paid growth subscription is active for occupancy upsell."
    );
  }

  if (blockedSubscriptions.length) {
    blockers.push("One or more growth subscriptions were blocked by policy.");
  }

  const uniqueBlockers = Array.from(new Set(blockers));

  return {
    generatedAt: new Date().toISOString(),
    providerId: provider.id,
    providerName: provider.name,
    status: blockedSubscriptions.length || reputation.status === "blocked"
      ? "blocked"
      : uniqueBlockers.length
        ? "action_required"
        : "ready",
    stages: {
      listing: {
        status: provider.confidenceScore >= 0.75 ? "ready" : "action_required",
        providerStatus: provider.status,
        sourceConfidence: provider.confidenceScore
      },
      outreach: {
        status: providerOutreach.some((item) => item.status === "blocked")
          ? "blocked"
          : providerOutreach.some((item) => item.status === "sent")
            ? "sent"
            : providerOutreach.some((item) => item.status === "queued")
              ? "queued"
              : "not_started",
        total: providerOutreach.length,
        queued: providerOutreach.filter((item) => item.status === "queued").length,
        sent: providerOutreach.filter((item) => item.status === "sent").length,
        blocked: providerOutreach.filter((item) => item.status === "blocked").length
      },
      claim: {
        status: claim?.status ?? "not_started",
        total: providerClaims.length,
        latestClaimId: claim?.id,
        readyForAdminReview: claimStatus?.readyForAdminReview ?? false,
        canEditProfile: claimStatus?.canEditProfile ?? false
      },
      verification: {
        total: verificationAttempts.length,
        pending: verificationAttempts.filter((attempt) => attempt.status === "pending").length,
        passed: verificationAttempts.filter((attempt) => attempt.status === "passed").length,
        failed: verificationAttempts.filter((attempt) => attempt.status === "failed").length,
        expired: verificationAttempts.filter((attempt) => attempt.status === "expired").length
      },
      reputation: {
        status: reputation.status,
        publishedReviews: reputation.reviewSummary.publishedReviews,
        queuedRequests: reputation.campaignSummary.queuedRequests,
        blockers: reputation.blockers
      },
      growth: {
        status: blockedSubscriptions.length
          ? "blocked"
          : activeSubscriptions.length
            ? "active"
            : pendingSubscriptions.length
              ? "pending_contract"
              : "not_started",
        subscriptions: subscriptions.length,
        activeSubscriptions: activeSubscriptions.length,
        activeEntitlements: entitlements.map((entitlement) => entitlement.featureKey)
      }
    },
    blockers: uniqueBlockers,
    nextActions: uniqueBlockers.length
      ? uniqueBlockers
      : ["Provider onboarding is ready: profile, claim, reputation, and growth paths are operational."]
  };
}
