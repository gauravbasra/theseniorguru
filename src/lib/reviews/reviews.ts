import type {
  CreateReviewInput,
  PublishReviewResponseInput,
  PublishReviewResponseResult,
  PartnerReviewRecord,
  ReviewModerationDashboard,
  ReviewModerationInput,
  ReviewModerationRecord,
  ReviewRecord,
  ReviewResponseDraft,
  ReviewResponseRecord,
  ReviewSentimentRecord
} from "@/lib/domain/reviews";
import { recordAuditEvent } from "@/lib/audit-events";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById, listProviders } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedReviews: ReviewRecord[] = [];
const seedReviewResponses: ReviewResponseRecord[] = [];
const seedReviewModerationCases: ReviewModerationRecord[] = [];
const seedReviewSentiment: ReviewSentimentRecord[] = [];

export class ReviewResponsePublishError extends Error {
  status: number;

  constructor(message: string, status = 422) {
    super(message);
    this.name = "ReviewResponsePublishError";
    this.status = status;
  }
}

function mapReview(row: Record<string, unknown>): ReviewRecord {
  return {
    id: String(row.id),
    providerId: String(row.provider_id),
    reviewerName: String(row.reviewer_name),
    reviewerEmail: row.reviewer_email ? String(row.reviewer_email) : undefined,
    rating: Number(row.rating),
    title: row.title ? String(row.title) : undefined,
    body: row.body ? String(row.body) : undefined,
    status: row.status as ReviewRecord["status"],
    source: String(row.source),
    createdAt: String(row.created_at)
  };
}

function mapReviewResponse(row: Record<string, unknown>): ReviewResponseRecord {
  return {
    id: String(row.id),
    reviewId: String(row.review_id),
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    body: String(row.body),
    status: row.status as ReviewResponseRecord["status"],
    generatedByAi: Boolean(row.generated_by_ai),
    createdAt: String(row.created_at),
    publishedAt: row.published_at ? String(row.published_at) : undefined
  };
}

function mapReviewModeration(row: Record<string, unknown>): ReviewModerationRecord {
  return {
    id: String(row.id),
    reviewId: String(row.review_id),
    providerId: String(row.provider_id),
    previousStatus: row.previous_status as ReviewRecord["status"],
    newStatus: row.new_status as ReviewRecord["status"],
    reason: String(row.reason),
    notes: row.notes ? String(row.notes) : undefined,
    actorId: row.actor_id ? String(row.actor_id) : undefined,
    policyDecision: String(row.policy_decision),
    createdAt: String(row.created_at)
  };
}

function mapReviewSentiment(row: Record<string, unknown>): ReviewSentimentRecord {
  return {
    id: String(row.id),
    reviewId: String(row.review_id),
    providerId: String(row.provider_id),
    sentiment: row.sentiment as ReviewSentimentRecord["sentiment"],
    score: Number(row.score),
    themes: Array.isArray(row.themes) ? row.themes.map(String) : [],
    summary: String(row.summary),
    createdAt: String(row.created_at)
  };
}

async function getReviewById(reviewId: string): Promise<ReviewRecord | null> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedReviews.find((review) => review.id === reviewId) ?? null;
  }

  const { data, error } = await supabase.from("reviews").select("*").eq("id", reviewId).maybeSingle();

  if (error) {
    throw new Error(`Review lookup failed: ${error.message}`);
  }

  return data ? mapReview(data) : null;
}

export async function listReviewModerationQueue(input: {
  providerId?: string;
  status?: ReviewRecord["status"];
} = {}): Promise<ReviewRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedReviews.filter((review) =>
      (!input.providerId || review.providerId === input.providerId) &&
      (!input.status || review.status === input.status)
    );
  }

  let query = supabase.from("reviews").select("*").order("created_at", { ascending: false });

  if (input.providerId) {
    query = query.eq("provider_id", input.providerId);
  }

  if (input.status) {
    query = query.eq("status", input.status);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Review moderation queue query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReview);
}

async function listReviewModerationCases(input: { providerId?: string; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 20), 100));
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedReviewModerationCases
      .filter((record) => !input.providerId || record.providerId === input.providerId)
      .slice(0, limit);
  }

  let query = supabase
    .from("review_moderation_cases")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (input.providerId) {
    query = query.eq("provider_id", input.providerId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Review moderation case query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReviewModeration);
}

function hoursSince(iso: string) {
  return (Date.now() - Date.parse(iso)) / (60 * 60 * 1000);
}

function average(values: number[]) {
  if (!values.length) return undefined;
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 100) / 100;
}

export async function getReviewModerationDashboard(input: { providerId?: string } = {}): Promise<ReviewModerationDashboard> {
  const [reviews, recentDecisions] = await Promise.all([
    listReviewModerationQueue({ providerId: input.providerId }),
    listReviewModerationCases({ providerId: input.providerId, limit: 20 })
  ]);
  const pending = reviews.filter((review) => review.status === "pending_moderation");
  const overduePending = pending.filter((review) => hoursSince(review.createdAt) >= 48).length;
  const dueSoonPending = pending.filter((review) => {
    const age = hoursSince(review.createdAt);
    return age >= 24 && age < 48;
  }).length;
  const providerGroups = new Map<string, ReviewRecord[]>();

  reviews.forEach((review) => {
    providerGroups.set(review.providerId, [...(providerGroups.get(review.providerId) ?? []), review]);
  });

  const providerBreakdown = Array.from(providerGroups.entries())
    .map(([providerId, providerReviews]) => {
      const providerPending = providerReviews.filter((review) => review.status === "pending_moderation");

      return {
        providerId,
        pendingModeration: providerPending.length,
        overduePending: providerPending.filter((review) => hoursSince(review.createdAt) >= 48).length,
        averageRating: average(providerReviews.map((review) => review.rating))
      };
    })
    .sort((left, right) => right.overduePending - left.overduePending || right.pendingModeration - left.pendingModeration);
  const blockers = [
    ...(overduePending ? [`${overduePending} review(s) are older than the 48-hour moderation SLA.`] : []),
    ...(pending.length >= 10 ? ["Moderation queue volume is elevated and needs reviewer assignment."] : []),
    ...(reviews.some((review) => review.status === "blocked_by_policy") ? ["Policy-blocked review records require admin review."] : [])
  ];

  return {
    generatedAt: new Date().toISOString(),
    filters: {
      providerId: input.providerId
    },
    totals: {
      reviews: reviews.length,
      pendingModeration: pending.length,
      published: reviews.filter((review) => review.status === "published").length,
      hidden: reviews.filter((review) => review.status === "hidden").length,
      removed: reviews.filter((review) => review.status === "removed").length,
      blockedByPolicy: reviews.filter((review) => review.status === "blocked_by_policy").length,
      overduePending,
      dueSoonPending
    },
    providerBreakdown,
    queue: pending.slice(0, 50),
    recentDecisions,
    blockers,
    nextActions: blockers.length
      ? blockers
      : ["Review moderation is within SLA. Continue publishing eligible reviews and scoring sentiment."]
  };
}

export async function listProviderReviews(providerId: string): Promise<ReviewRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedReviews.filter((review) => review.providerId === providerId && review.status === "published");
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("provider_id", providerId)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Review query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReview);
}

export async function listPartnerReviews(input: { providerId?: string } = {}): Promise<PartnerReviewRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const providers = await listProviders();
    const providerById = new Map(providers.map((provider) => [provider.id, provider]));

    return seedReviews
      .filter((review) => review.status === "published")
      .filter((review) => !input.providerId || review.providerId === input.providerId)
      .map(({ reviewerEmail: _reviewerEmail, ...review }) => {
        const provider = providerById.get(review.providerId);

        return {
          ...review,
          providerSlug: provider?.slug,
          providerName: provider?.name
        };
      });
  }

  let query = supabase
    .from("reviews")
    .select("*, providers(id, slug, name)")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (input.providerId) {
    query = query.eq("provider_id", input.providerId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Partner review query failed: ${error.message}`);
  }

  return (data ?? []).map((row) => {
    const review = mapReview(row);
    const providerRow = Array.isArray(row.providers) ? row.providers[0] : row.providers;
    const { reviewerEmail: _reviewerEmail, ...publicReview } = review;

    return {
      ...publicReview,
      providerSlug:
        providerRow && typeof providerRow === "object" && "slug" in providerRow
          ? String((providerRow as Record<string, unknown>).slug)
          : undefined,
      providerName:
        providerRow && typeof providerRow === "object" && "name" in providerRow
          ? String((providerRow as Record<string, unknown>).name)
          : undefined
    };
  });
}

export async function listProviderReviewPipeline(providerId: string): Promise<ReviewRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedReviews.filter((review) => review.providerId === providerId);
  }

  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Review pipeline query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReview);
}

export async function listReviewSentiment(providerId: string): Promise<ReviewSentimentRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedReviewSentiment.filter((sentiment) => sentiment.providerId === providerId);
  }

  const { data, error } = await supabase
    .from("review_sentiment")
    .select("*")
    .eq("provider_id", providerId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Review sentiment query failed: ${error.message}`);
  }

  return (data ?? []).map(mapReviewSentiment);
}

export async function createProviderReview(input: CreateReviewInput): Promise<ReviewRecord> {
  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new Error("Provider not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "review",
    subjectId: input.providerId,
    actionKey: "submit_review",
    input
  });

  const status = policy.decision.startsWith("blocked") ? "blocked_by_policy" : "pending_moderation";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const review: ReviewRecord = {
      id: `pending-review-${Date.now()}`,
      providerId: input.providerId,
      reviewerName: input.reviewerName,
      reviewerEmail: input.reviewerEmail,
      rating: input.rating,
      title: input.title,
      body: input.body,
      status,
      source: "first_party",
      createdAt: new Date().toISOString()
    };
    seedReviews.unshift(review);
    return review;
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert({
      provider_id: input.providerId,
      reviewer_name: input.reviewerName,
      reviewer_email: input.reviewerEmail,
      rating: input.rating,
      title: input.title,
      body: input.body,
      status,
      source: "first_party"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Review submission failed: ${error.message}`);
  }

  return mapReview(data);
}

export async function moderateReview(input: ReviewModerationInput): Promise<ReviewModerationRecord> {
  const review = await getReviewById(input.reviewId);

  if (!review) {
    throw new Error("Review not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "review_moderation",
    subjectId: input.reviewId,
    actionKey: "moderate_review",
    input: {
      review,
      status: input.status,
      reason: input.reason,
      notes: input.notes
    }
  });

  if (policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Review moderation blocked by policy");
  }

  const now = new Date().toISOString();
  const moderation: ReviewModerationRecord = {
    id: `review-moderation-${Date.now()}`,
    reviewId: review.id,
    providerId: review.providerId,
    previousStatus: review.status,
    newStatus: input.status,
    reason: input.reason,
    notes: input.notes,
    actorId: input.actorId,
    policyDecision: policy.decision,
    createdAt: now
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    review.status = input.status;
    seedReviewModerationCases.unshift(moderation);
    return moderation;
  }

  const { error: reviewError } = await supabase
    .from("reviews")
    .update({ status: input.status })
    .eq("id", review.id);

  if (reviewError) {
    throw new Error(`Review moderation update failed: ${reviewError.message}`);
  }

  const { data, error } = await supabase
    .from("review_moderation_cases")
    .insert({
      review_id: review.id,
      provider_id: review.providerId,
      previous_status: review.status,
      new_status: input.status,
      reason: input.reason,
      notes: input.notes,
      actor_id: input.actorId,
      policy_decision: policy.decision
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Review moderation case creation failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "review.moderated",
    subject_type: "review",
    subject_id: review.id,
    payload: {
      providerId: review.providerId,
      previousStatus: review.status,
      newStatus: input.status,
      reason: input.reason,
      policyDecision: policy.decision
    }
  });

  return mapReviewModeration(data);
}

export async function scoreReviewSentiment(reviewId: string): Promise<ReviewSentimentRecord> {
  const review = await getReviewById(reviewId);

  if (!review) {
    throw new Error("Review not found");
  }

  const body = `${review.title ?? ""} ${review.body ?? ""}`.toLowerCase();
  const positiveHits = ["kind", "helpful", "warm", "clean", "safe", "responsive", "excellent", "great", "trust"].filter((word) => body.includes(word)).length;
  const negativeHits = ["slow", "missed", "dirty", "unsafe", "rude", "expensive", "confusing", "poor", "bad"].filter((word) => body.includes(word)).length;
  const rawScore = review.rating + positiveHits * 0.35 - negativeHits * 0.5;
  const score = Math.max(0, Math.min(1, Math.round((rawScore / 5) * 100) / 100));
  const sentiment: ReviewSentimentRecord["sentiment"] = score >= 0.75 ? "positive" : score <= 0.45 ? "negative" : "neutral";
  const themes = [
    body.includes("staff") || body.includes("team") ? "staff" : undefined,
    body.includes("clean") || body.includes("room") ? "environment" : undefined,
    body.includes("call") || body.includes("responsive") || body.includes("communication") ? "communication" : undefined,
    body.includes("cost") || body.includes("price") || body.includes("expensive") ? "pricing" : undefined,
    body.includes("safe") || body.includes("care") ? "care quality" : undefined
  ].filter(Boolean) as string[];
  const summary = `${sentiment} review signal based on rating ${review.rating}/5${themes.length ? ` with themes: ${themes.join(", ")}` : ""}.`;
  const now = new Date().toISOString();
  const record: ReviewSentimentRecord = {
    id: `review-sentiment-${Date.now()}`,
    reviewId: review.id,
    providerId: review.providerId,
    sentiment,
    score,
    themes,
    summary,
    createdAt: now
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    seedReviewSentiment.unshift(record);
    return record;
  }

  const { data, error } = await supabase
    .from("review_sentiment")
    .insert({
      review_id: review.id,
      provider_id: review.providerId,
      sentiment,
      score,
      themes,
      summary
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Review sentiment creation failed: ${error.message}`);
  }

  return mapReviewSentiment(data);
}

export async function generateReviewResponse(reviewId: string): Promise<ReviewResponseDraft> {
  const body =
    "Thank you for sharing your experience. We appreciate your feedback and use it to keep improving communication, care, and family support.";

  const policy = await runPolicyCheck({
    subjectType: "review_response",
    subjectId: reviewId,
    actionKey: "generate_review_response",
    input: { reviewId, body }
  });

  return {
    reviewId,
    body,
    generatedByAi: true,
    policyDecision: policy.decision
  };
}

export async function publishReviewResponse(input: PublishReviewResponseInput): Promise<PublishReviewResponseResult> {
  const review = await getReviewById(input.reviewId);

  if (!review) {
    throw new ReviewResponsePublishError("Review not found", 404);
  }

  if (input.providerId !== review.providerId) {
    throw new ReviewResponsePublishError("Review response provider mismatch", 403);
  }

  if (review.status !== "published") {
    throw new ReviewResponsePublishError("Review must be published before a provider response can be published", 409);
  }

  const provider = await getProviderById(input.providerId);

  if (!provider) {
    throw new ReviewResponsePublishError("Provider not found", 404);
  }

  const dryRun = input.dryRun !== false;
  const policy = await runPolicyCheck({
    subjectType: "review_response",
    subjectId: input.reviewId,
    actionKey: "publish_review_response",
    input: {
      review,
      providerId: input.providerId,
      body: input.body,
      generatedByAi: input.generatedByAi ?? false,
      dryRun
    }
  });

  const blocked = policy.decision === "blocked" || policy.decision === "blocked_non_overridable";
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const response: ReviewResponseRecord = {
      id: `review-response-${Date.now()}`,
      reviewId: input.reviewId,
      providerId: review.providerId,
      body: input.body,
      status: blocked ? "blocked" : dryRun ? "approved" : "published",
      generatedByAi: input.generatedByAi ?? false,
      policyDecision: policy.decision,
      createdAt: now,
      publishedAt: blocked || dryRun ? undefined : now
    };

    if (!dryRun) {
      seedReviewResponses.unshift(response);
    }

    const auditEvent = await recordAuditEvent({
      actorId: input.actorId,
      actorType: input.actorId ? "provider" : "system",
      eventType: blocked
        ? "review_response.blocked"
        : dryRun
          ? "review_response.publish_previewed"
          : "review_response.published",
      subjectType: "review",
      subjectId: input.reviewId,
      payload: {
        providerId: review.providerId,
        dryRun,
        generatedByAi: input.generatedByAi ?? false,
        policyDecision: policy.decision,
        reasons: policy.reasons
      }
    });

    return {
      response,
      dryRun,
      policyDecision: policy.decision,
      nextStatus: response.status,
      auditEventId: auditEvent.id
    };
  }

  let response: ReviewResponseRecord = {
    id: `review-response-preview-${Date.now()}`,
    reviewId: input.reviewId,
    providerId: review.providerId,
    body: input.body,
    status: blocked ? "blocked" : "approved",
    generatedByAi: input.generatedByAi ?? false,
    policyDecision: policy.decision,
    createdAt: now
  };

  if (!dryRun) {
    const { data, error } = await supabase
      .from("review_responses")
      .insert({
        review_id: input.reviewId,
        provider_id: review.providerId,
        body: input.body,
        status: blocked ? "blocked" : "published",
        generated_by_ai: input.generatedByAi ?? false,
        published_at: blocked ? undefined : now
      })
      .select("*")
      .single();

    if (error) {
      throw new ReviewResponsePublishError(`Review response publish failed: ${error.message}`, 500);
    }

    response = { ...mapReviewResponse(data), policyDecision: policy.decision };
  }

  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: input.actorId ? "provider" : "system",
    eventType: blocked
      ? "review_response.blocked"
      : dryRun
        ? "review_response.publish_previewed"
        : "review_response.published",
    subjectType: "review",
    subjectId: input.reviewId,
    payload: {
      providerId: review.providerId,
      dryRun,
      generatedByAi: input.generatedByAi ?? false,
      policyDecision: policy.decision,
      reasons: policy.reasons
    }
  });

  return {
    response,
    dryRun,
    policyDecision: policy.decision,
    nextStatus: response.status,
    auditEventId: auditEvent.id
  };
}
