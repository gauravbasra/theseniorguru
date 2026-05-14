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

export type ExtractedEntityQualityFinding = {
  severity: "low" | "medium" | "high" | "critical";
  flagKey: string;
  message: string;
};

export type ExtractedEntityQualityAuditRecord = {
  entityId: string;
  name: string;
  reviewStatus: ExtractedEntityReviewStatus;
  recommendedStatus: ExtractedEntityReviewStatus;
  qualityScore: number;
  imageCount: number;
  findings: ExtractedEntityQualityFinding[];
};

export type RunExtractedEntityQualityAuditInput = {
  status?: ExtractedEntityReviewStatus | "all";
  limit?: number;
  minImages?: number;
  actorId?: string;
};

export type ExtractedEntityQualityAuditResult = {
  audited: number;
  flagged: number;
  highRisk: number;
  minImages: number;
  results: ExtractedEntityQualityAuditRecord[];
};

export type ExtractedEntityReviewQueuePriority = "critical" | "high" | "medium" | "low";

export type ExtractedEntityReviewQueueItem = {
  entity: ExtractedEntityRecord;
  quality: ExtractedEntityQualityAuditRecord;
  assignment?: ExtractedEntityReviewAssignmentRecord;
  priority: ExtractedEntityReviewQueuePriority;
  confidenceBand: "high" | "medium" | "low";
  duplicateRisk: "high" | "medium" | "low";
  route: "approve_ready" | "human_review" | "legal_review" | "image_rights_review" | "duplicate_review";
  slaStatus: "unassigned" | "on_track" | "due_soon" | "overdue" | "completed";
  blockers: string[];
  nextActions: string[];
};

export type ExtractedEntityReviewQueueSummary = {
  generatedAt: string;
  status: "ready" | "action_required" | "blocked";
  minImages: number;
  totals: {
    entities: number;
    approveReady: number;
    humanReview: number;
    legalReview: number;
    imageRightsReview: number;
    duplicateReview: number;
    lowConfidence: number;
    unassigned: number;
    overdue: number;
  };
  items: ExtractedEntityReviewQueueItem[];
  blockers: string[];
  nextActions: string[];
};

export type ExtractedEntityReviewAssignmentStatus = "assigned" | "in_review" | "completed" | "escalated";

export type ExtractedEntityReviewAssignmentRecord = {
  id: string;
  entityId: string;
  route: ExtractedEntityReviewQueueItem["route"];
  status: ExtractedEntityReviewAssignmentStatus;
  assignedTo: string;
  assignedBy?: string;
  dueAt: string;
  notes?: string;
  createdAt: string;
  completedAt?: string;
};

export type AssignExtractedEntityReviewInput = {
  entityId: string;
  assignedTo: string;
  assignedBy?: string;
  route?: ExtractedEntityReviewQueueItem["route"];
  dueAt?: string;
  notes?: string;
};

export type ExtractedEntityReviewEscalationSummary = {
  generatedAt: string;
  status: "ready" | "attention_needed" | "blocked";
  totals: {
    entities: number;
    overdue: number;
    dueSoon: number;
    unassigned: number;
    blockedRoutes: number;
  };
  overdue: ExtractedEntityReviewQueueItem[];
  dueSoon: ExtractedEntityReviewQueueItem[];
  unassigned: ExtractedEntityReviewQueueItem[];
  blockedRoutes: ExtractedEntityReviewQueueItem[];
  nextActions: string[];
};
