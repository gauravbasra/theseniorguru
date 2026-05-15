import type {
  ReputationTrendBucket,
  ReputationTrendPoint,
  ReputationTrendSnapshot,
  ReputationTrendSummary,
  ReviewRecord,
  ReviewSentimentRecord
} from "@/lib/domain/reviews";
import { recordAuditEvent } from "@/lib/audit-events";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getExternalReviewIntegrationSummary } from "@/lib/reviews/external-integrations";
import { listProviderReviewPipeline, listReviewSentiment } from "@/lib/reviews/reviews";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const localReputationSnapshots: ReputationTrendSnapshot[] = [];

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function scoreRating(score: number): ReputationTrendSummary["score"]["rating"] {
  if (score >= 75) return "strong";
  if (score >= 45) return "developing";
  return "at_risk";
}

function average(values: number[]) {
  if (!values.length) return undefined;
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100;
}

function periodLengthDays(bucket: ReputationTrendBucket) {
  if (bucket === "daily") return 1;
  if (bucket === "monthly") return 30;
  return 7;
}

function isoDate(date: Date) {
  return date.toISOString();
}

function makeTrendBuckets(windowDays: number, bucket: ReputationTrendBucket): ReputationTrendPoint[] {
  const now = new Date();
  const periodDays = periodLengthDays(bucket);
  const start = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const buckets: ReputationTrendPoint[] = [];

  for (let cursor = start; cursor < now;) {
    const periodStart = new Date(cursor);
    const periodEnd = new Date(Math.min(now.getTime(), periodStart.getTime() + periodDays * 24 * 60 * 60 * 1000));

    buckets.push({
      periodStart: isoDate(periodStart),
      periodEnd: isoDate(periodEnd),
      submittedReviews: 0,
      publishedReviews: 0,
      positiveSentiment: 0,
      neutralSentiment: 0,
      negativeSentiment: 0
    });

    cursor = periodEnd;
  }

  return buckets.length ? buckets : [{
    periodStart: isoDate(start),
    periodEnd: isoDate(now),
    submittedReviews: 0,
    publishedReviews: 0,
    positiveSentiment: 0,
    neutralSentiment: 0,
    negativeSentiment: 0
  }];
}

function bucketFor(dateValue: string, buckets: ReputationTrendPoint[]) {
  const time = Date.parse(dateValue);
  return buckets.find((bucket) => time >= Date.parse(bucket.periodStart) && time <= Date.parse(bucket.periodEnd));
}

function buildTrend(
  reviews: ReviewRecord[],
  sentimentRecords: ReviewSentimentRecord[],
  windowDays: number,
  bucket: ReputationTrendBucket
) {
  const buckets = makeTrendBuckets(windowDays, bucket);
  const ratingsByBucket = new Map<string, number[]>();

  reviews.forEach((review) => {
    const period = bucketFor(review.createdAt, buckets);

    if (!period) return;

    period.submittedReviews += 1;

    if (review.status === "published") {
      period.publishedReviews += 1;
      ratingsByBucket.set(period.periodStart, [...(ratingsByBucket.get(period.periodStart) ?? []), review.rating]);
    }
  });

  sentimentRecords.forEach((record) => {
    const period = bucketFor(record.createdAt, buckets);

    if (!period) return;

    if (record.sentiment === "positive") period.positiveSentiment += 1;
    if (record.sentiment === "neutral") period.neutralSentiment += 1;
    if (record.sentiment === "negative") period.negativeSentiment += 1;
  });

  return buckets.map((period) => ({
    ...period,
    averageRating: average(ratingsByBucket.get(period.periodStart) ?? [])
  }));
}

export async function getProviderReputationTrends(input: {
  providerId: string;
  windowDays?: number;
  bucket?: ReputationTrendBucket;
}): Promise<ReputationTrendSummary> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const windowDays = Math.max(7, Math.min(Number(input.windowDays ?? 90), 365));
  const bucket = input.bucket ?? "weekly";
  const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const [reviews, sentimentRecords, externalIntegrations] = await Promise.all([
    listProviderReviewPipeline(provider.id),
    listReviewSentiment(provider.id),
    getExternalReviewIntegrationSummary(provider.id)
  ]);
  const scopedReviews = reviews.filter((review) => Date.parse(review.createdAt) >= since);
  const scopedSentiment = sentimentRecords.filter((record) => Date.parse(record.createdAt) >= since);
  const published = scopedReviews.filter((review) => review.status === "published");
  const pendingModeration = scopedReviews.filter((review) => review.status === "pending_moderation").length;
  const blockedByPolicy = scopedReviews.filter((review) => review.status === "blocked_by_policy").length;
  const averageRating = average(published.map((review) => review.rating));
  const averageSentimentScore = average(scopedSentiment.map((record) => record.score));
  const negativeSentiment = scopedSentiment.filter((record) => record.sentiment === "negative").length;
  const scoreReasons: string[] = [];
  const score = clampScore(
    (averageRating ? (averageRating / 5) * 55 : 10) +
    (averageSentimentScore ? averageSentimentScore * 25 : 5) +
    (externalIntegrations.totals.connected / Math.max(1, externalIntegrations.totals.sources)) * 20 -
    pendingModeration * 4 -
    blockedByPolicy * 10 -
    negativeSentiment * 5
  );

  if (published.length) scoreReasons.push(`${published.length} published reviews in the selected window.`);
  if (averageRating) scoreReasons.push(`Average published rating is ${averageRating}.`);
  if (averageSentimentScore) scoreReasons.push(`Average sentiment score is ${averageSentimentScore}.`);
  if (externalIntegrations.totals.connected) scoreReasons.push(`${externalIntegrations.totals.connected} external review source(s) are credential-ready.`);
  if (pendingModeration) scoreReasons.push(`${pendingModeration} review(s) need moderation.`);
  if (blockedByPolicy) scoreReasons.push(`${blockedByPolicy} review item(s) are blocked by policy.`);

  const blockers = [
    ...(pendingModeration ? ["Review moderation backlog must be cleared to improve reputation trend confidence."] : []),
    ...(blockedByPolicy ? ["Policy-blocked review records require admin review."] : []),
    ...externalIntegrations.blockers
  ];

  return {
    generatedAt: new Date().toISOString(),
    providerId: provider.id,
    providerName: provider.name,
    filters: { windowDays, bucket },
    score: {
      value: score,
      rating: scoreRating(score),
      reasons: scoreReasons.length ? scoreReasons : ["No reputation activity has been recorded in the selected window."]
    },
    totals: {
      submittedReviews: scopedReviews.length,
      publishedReviews: published.length,
      pendingModeration,
      blockedByPolicy,
      averageRating,
      averageSentimentScore,
      externalConnectedSources: externalIntegrations.totals.connected,
      externalActionRequired: externalIntegrations.totals.actionRequired
    },
    trend: buildTrend(scopedReviews, scopedSentiment, windowDays, bucket),
    blockers,
    nextActions: blockers.length
      ? blockers
      : ["Reputation trend is healthy. Continue review requests, sentiment scoring, and provider responses."]
  };
}

export async function recordProviderReputationTrendSnapshot(input: {
  providerId: string;
  windowDays?: number;
  bucket?: ReputationTrendBucket;
  actorId?: string;
}): Promise<ReputationTrendSnapshot> {
  const summary = await getProviderReputationTrends(input);
  const policy = await runPolicyCheck({
    subjectType: "reputation_score",
    subjectId: summary.providerId,
    actionKey: "record_reputation_trend_snapshot",
    input: summary
  });

  if (policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Reputation trend snapshot blocked by policy");
  }

  const snapshot: ReputationTrendSnapshot = {
    id: `reputation-score-${Date.now()}`,
    providerId: summary.providerId,
    score: summary.score.value,
    rating: summary.score.rating,
    snapshotPayload: summary,
    createdAt: new Date().toISOString()
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    localReputationSnapshots.unshift(snapshot);
  } else {
    const { data, error } = await supabase
      .from("reputation_scores")
      .insert({
        provider_id: summary.providerId,
        score: summary.score.value,
        rating: summary.score.rating,
        published_reviews: summary.totals.publishedReviews,
        average_rating: summary.totals.averageRating,
        average_sentiment_score: summary.totals.averageSentimentScore,
        external_connected_sources: summary.totals.externalConnectedSources,
        trend_payload: summary
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(`Reputation score snapshot failed: ${error.message}`);
    }

    snapshot.id = String(data.id);
    snapshot.createdAt = String(data.created_at ?? snapshot.createdAt);
  }

  await recordAuditEvent({
    actorId: input.actorId,
    actorType: input.actorId ? "provider" : "system",
    eventType: "reputation_trend.snapshot_recorded",
    subjectType: "provider",
    subjectId: summary.providerId,
    payload: {
      score: summary.score.value,
      rating: summary.score.rating,
      windowDays: summary.filters.windowDays,
      bucket: summary.filters.bucket,
      blockers: summary.blockers
    }
  });

  return snapshot;
}
