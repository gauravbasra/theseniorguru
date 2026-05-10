export type ExtractedEntityReviewStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "duplicate"
  | "needs_human_review"
  | "needs_legal_review";

export type ExtractedEntityRecord = {
  id: string;
  importBatchId?: string;
  crawlPageId?: string;
  reviewStatus: ExtractedEntityReviewStatus;
  entityType: "provider" | string;
  name: string;
  normalizedName?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  websiteUrl?: string;
  categories: string[];
  rawPayload: Record<string, unknown>;
  extractedFields: Record<string, unknown>;
  confidenceScore: number;
  matchedProviderId?: string;
  createdAt: string;
};

export type CreateExtractedEntityInput = {
  importBatchId?: string;
  crawlPageId?: string;
  entityType?: "provider" | string;
  name: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  websiteUrl?: string;
  categories?: string[];
  rawPayload?: Record<string, unknown>;
  extractedFields?: Record<string, unknown>;
  confidenceScore?: number;
};

export type ExtractedEntityDecisionInput = {
  entityId: string;
  decision: "approved" | "rejected" | "duplicate";
  actorId?: string;
  adminNotes?: string;
  matchedProviderId?: string;
};

export type EntityMatchCandidateRecord = {
  id: string;
  extractedEntityId: string;
  providerId: string;
  providerName: string;
  matchScore: number;
  matchReasons: string[];
  createdAt: string;
};

export type EntityMatchResult = {
  entityId: string;
  reviewStatus: ExtractedEntityReviewStatus;
  candidateCount: number;
  topScore: number;
  candidates: EntityMatchCandidateRecord[];
};
