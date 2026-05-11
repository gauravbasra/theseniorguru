import type {
  CreateReviewInput,
  PublishReviewResponseInput,
  ReviewRecord,
  ReviewResponseDraft,
  ReviewResponseRecord
} from "@/lib/domain/reviews";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedReviews: ReviewRecord[] = [];
const seedReviewResponses: ReviewResponseRecord[] = [];

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

export async function publishReviewResponse(input: PublishReviewResponseInput): Promise<ReviewResponseRecord> {
  const review = await getReviewById(input.reviewId);

  if (!review) {
    throw new Error("Review not found");
  }

  const policy = await runPolicyCheck({
    subjectType: "review_response",
    subjectId: input.reviewId,
    actionKey: "publish_review_response",
    input: {
      review,
      body: input.body,
      generatedByAi: input.generatedByAi ?? false
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
      status: blocked ? "blocked" : "published",
      generatedByAi: input.generatedByAi ?? false,
      policyDecision: policy.decision,
      createdAt: now,
      publishedAt: blocked ? undefined : now
    };
    seedReviewResponses.unshift(response);
    return response;
  }

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
    throw new Error(`Review response publish failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "provider" : "system",
    event_type: blocked ? "review_response.blocked" : "review_response.published",
    subject_type: "review",
    subject_id: input.reviewId,
    payload: {
      providerId: review.providerId,
      generatedByAi: input.generatedByAi ?? false,
      policyDecision: policy.decision,
      reasons: policy.reasons
    }
  });

  return { ...mapReviewResponse(data), policyDecision: policy.decision };
}
