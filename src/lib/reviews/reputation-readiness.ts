import type { ReputationReadinessSummary } from "@/lib/domain/reviews";
import { getProviderById } from "@/lib/providers";
import { listReviewRequestCampaigns, listReviewRequests } from "@/lib/reviews/review-campaigns";
import { listProviderReviewPipeline } from "@/lib/reviews/reviews";

function average(values: number[]) {
  if (!values.length) {
    return undefined;
  }

  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10;
}

export async function getProviderReputationReadiness(providerId: string): Promise<ReputationReadinessSummary> {
  const provider = await getProviderById(providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const [reviews, campaigns, requests] = await Promise.all([
    listProviderReviewPipeline(provider.id),
    listReviewRequestCampaigns(provider.id),
    listReviewRequests(provider.id)
  ]);
  const published = reviews.filter((review) => review.status === "published");
  const pendingModeration = reviews.filter((review) => review.status === "pending_moderation").length;
  const blockedByPolicy = reviews.filter((review) => review.status === "blocked_by_policy").length;
  const queuedCampaigns = campaigns.filter((campaign) => campaign.status === "queued").length;
  const blockedCampaigns = campaigns.filter((campaign) => campaign.status === "blocked_by_policy").length;
  const queuedRequests = requests.filter((request) => request.status === "queued").length;
  const blockedRequests = requests.filter((request) => request.status === "blocked_by_policy").length;
  const blockers: string[] = [];

  if (!campaigns.length) {
    blockers.push("No consent-gated review request campaign has been created.");
  }

  if (blockedCampaigns || blockedRequests || blockedByPolicy) {
    blockers.push("One or more review/reputation items were blocked by policy and need review.");
  }

  if (queuedRequests && !published.length) {
    blockers.push("Review requests are queued but no published reviews exist yet.");
  }

  return {
    generatedAt: new Date().toISOString(),
    providerId: provider.id,
    status: blockedCampaigns || blockedRequests || blockedByPolicy
      ? "blocked"
      : blockers.length
        ? "action_required"
        : "ready",
    reviewSummary: {
      publishedReviews: published.length,
      averageRating: average(published.map((review) => review.rating)),
      pendingModeration,
      blockedByPolicy
    },
    campaignSummary: {
      campaigns: campaigns.length,
      queuedCampaigns,
      blockedCampaigns,
      queuedRequests,
      blockedRequests
    },
    blockers,
    nextActions: blockers.length
      ? blockers
      : ["Reputation workflow is ready. Continue collecting reviews and monitoring response opportunities."]
  };
}
