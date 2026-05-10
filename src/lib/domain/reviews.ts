export type ReviewRecord = {
  id: string;
  providerId: string;
  reviewerName: string;
  reviewerEmail?: string;
  rating: number;
  title?: string;
  body?: string;
  status: "pending_moderation" | "published" | "hidden" | "removed" | "blocked_by_policy";
  source: string;
  createdAt: string;
};

export type CreateReviewInput = {
  providerId: string;
  reviewerName: string;
  reviewerEmail?: string;
  rating: number;
  title?: string;
  body?: string;
};

export type ReviewResponseDraft = {
  reviewId: string;
  body: string;
  generatedByAi: boolean;
  policyDecision: string;
};

