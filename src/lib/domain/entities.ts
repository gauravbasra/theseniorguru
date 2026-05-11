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
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  categories: string[];
  careTypes?: string[];
  amenities?: string[];
  services?: string[];
  description?: string;
  pricingSignals?: Record<string, unknown>;
  licenseFields?: Record<string, unknown>;
  accreditationFields?: Record<string, unknown>;
  sourceUrl?: string;
  sourceRecordId?: string;
  fetchedAt?: string;
  licenseTermsStatus?: string;
  robotsDecision?: string;
  extractionConfidence?: number;
  duplicateMatchData?: Record<string, unknown>;
  imageAssets?: StagedListingImageRecord[];
  auditTrail?: StagedListingAuditEvent[];
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
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  county?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  categories?: string[];
  careTypes?: string[];
  amenities?: string[];
  services?: string[];
  description?: string;
  pricingSignals?: Record<string, unknown>;
  licenseFields?: Record<string, unknown>;
  accreditationFields?: Record<string, unknown>;
  sourceUrl?: string;
  sourceRecordId?: string;
  fetchedAt?: string;
  licenseTermsStatus?: string;
  robotsDecision?: string;
  extractionConfidence?: number;
  duplicateMatchData?: Record<string, unknown>;
  imageAssets?: StagedListingImageRecord[];
  auditTrail?: StagedListingAuditEvent[];
  rawPayload?: Record<string, unknown>;
  extractedFields?: Record<string, unknown>;
  confidenceScore?: number;
};

export type StagedListingImageReviewStatus = "pending_review" | "approved_for_storage" | "rejected" | "needs_rights_review";

export type StagedListingImageRecord = {
  url: string;
  sourceUrl: string;
  fetchedAt?: string;
  licenseTermsStatus: string;
  robotsDecision: string;
  reviewStatus: StagedListingImageReviewStatus;
  storageStatus: "not_stored" | "queued_for_storage" | "stored" | "blocked";
  altText?: string;
  credit?: string;
  ordinal?: number;
};

export type StagedListingAuditEvent = {
  at: string;
  actor: string;
  action: string;
  notes?: string;
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
