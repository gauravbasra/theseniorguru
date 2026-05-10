import type { CreateReviewInput, ReviewRecord, ReviewResponseDraft } from "@/lib/domain/reviews";
import { runPolicyCheck } from "@/lib/policy";
import { getProviderById } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedReviews: ReviewRecord[] = [];

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
    return {
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

