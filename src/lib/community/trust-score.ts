import { recordAuditEvent } from "@/lib/audit-events";
import { getAppFeed } from "@/lib/community/feed";
import { listExpertProfiles } from "@/lib/community/experts";
import { listCommunityGroups, listCommunityGroupMembers, listCommunityTopicSubscriptions } from "@/lib/community/groups";
import { listCommunityReports } from "@/lib/community/moderation";
import type { LocalTrustScoreInput, LocalTrustScoreResult } from "@/lib/domain/community";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

function ratingForScore(score: number): LocalTrustScoreResult["rating"] {
  if (score >= 75) return "strong";
  if (score >= 45) return "developing";
  return "needs_review";
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scopeMatches(input: { city?: string; state?: string }, item: { city?: string; state?: string }) {
  return (!input.city || item.city?.toLowerCase() === input.city.toLowerCase()) &&
    (!input.state || item.state?.toLowerCase() === input.state.toLowerCase());
}

export async function getLocalTrustScore(input: LocalTrustScoreInput = {}): Promise<LocalTrustScoreResult> {
  const policy = await runPolicyCheck({
    subjectType: "local_trust_score",
    actionKey: "calculate_local_trust_score",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Local trust scoring blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const [groups, experts, subscriptions, feed, reports] = await Promise.all([
    listCommunityGroups({ city: input.city, state: input.state }),
    listExpertProfiles({ status: "verified", city: input.city, state: input.state }),
    listCommunityTopicSubscriptions({ city: input.city, state: input.state, status: "active" }),
    getAppFeed(),
    listCommunityReports({ status: "open" })
  ]);
  const localFeed = feed.filter((item) => scopeMatches(input, item));
  const activeMemberCounts = await Promise.all(
    groups.map(async (group) => (await listCommunityGroupMembers(group.id)).filter((member) => member.status === "active").length)
  );
  const activeMembers = activeMemberCounts.reduce((total, count) => total + count, 0);
  const moderationReports = reports.length;
  const baseScore =
    20 +
    Math.min(groups.length * 12, 24) +
    Math.min(activeMembers * 4, 16) +
    Math.min(experts.length * 16, 24) +
    Math.min(subscriptions.length * 4, 16) +
    Math.min(localFeed.length * 3, 12) -
    Math.min(moderationReports * 8, 32);
  const score = clampScore(baseScore);
  const rating = ratingForScore(score);
  const reasons = [
    `${groups.length} local community group${groups.length === 1 ? "" : "s"}`,
    `${experts.length} verified expert${experts.length === 1 ? "" : "s"}`,
    `${subscriptions.length} active topic subscription${subscriptions.length === 1 ? "" : "s"}`,
    `${localFeed.length} local feed item${localFeed.length === 1 ? "" : "s"}`,
    `${moderationReports} open moderation report${moderationReports === 1 ? "" : "s"}`
  ];
  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: input.actorId ? "admin" : "system",
    eventType: "local_trust_score.calculated",
    subjectType: "local_trust_score",
    payload: {
      city: input.city,
      state: input.state,
      score,
      rating,
      signals: {
        communityGroups: groups.length,
        activeMembers,
        verifiedExperts: experts.length,
        activeTopicSubscriptions: subscriptions.length,
        localFeedItems: localFeed.length,
        moderationReports
      },
      policyDecision: policy.decision
    }
  });

  if (supabase) {
    const { error } = await supabase.from("local_trust_scores").insert({
      city: input.city,
      state: input.state,
      score,
      rating,
      signal_payload: {
        communityGroups: groups.length,
        activeMembers,
        verifiedExperts: experts.length,
        activeTopicSubscriptions: subscriptions.length,
        localFeedItems: localFeed.length,
        moderationReports,
        auditEventId: auditEvent.id,
        policyDecision: policy.decision
      }
    });

    if (error) {
      throw new Error(`Local trust score persistence failed: ${error.message}`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: supabase ? "supabase" : "local_fallback",
    scope: {
      city: input.city,
      state: input.state
    },
    score,
    rating,
    signals: {
      communityGroups: groups.length,
      activeMembers,
      verifiedExperts: experts.length,
      activeTopicSubscriptions: subscriptions.length,
      localFeedItems: localFeed.length,
      moderationReports
    },
    reasons,
    auditEventId: auditEvent.id,
    nextActions: [
      ...(rating === "strong" ? ["Use this local market in community growth and provider trust surfaces."] : []),
      ...(rating === "developing" ? ["Add verified experts, local posts, and topic subscribers before promoting this market heavily."] : []),
      ...(rating === "needs_review" ? ["Review local moderation load and seed additional trusted community signals before launch promotion."] : [])
    ]
  };
}
