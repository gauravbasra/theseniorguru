export type ProviderStatus = "imported" | "verified_by_source" | "claimed" | "verified" | "growth_partner";

export type ProviderRecord = {
  id: string;
  name: string;
  slug: string;
  status: ProviderStatus;
  categories: string[];
  address?: string;
  city: string;
  state: string;
  zip?: string;
  phone?: string;
  websiteUrl?: string;
  imageUrl?: string;
  priceLabel?: string;
  summary?: string;
  confidenceScore: number;
  source: {
    name: string;
    url?: string;
    fetchedAt: string;
    confidence: number;
  };
};

export type ProviderCategoryRecord = {
  key: string;
  name: string;
  providerCount: number;
  states: string[];
};

export type LocationSearchResult = {
  city: string;
  state: string;
  providerCount: number;
  categories: string[];
};

export type ProviderPortalUpdateInput = {
  providerId: string;
  actorId?: string;
  displayName?: string;
  phone?: string;
  websiteUrl?: string;
  summary?: string;
  categories?: string[];
  availability?: Record<string, unknown>;
  pricing?: Record<string, unknown>;
  attestationAccepted: boolean;
};

export type ProviderPortalUpdateResult = {
  id: string;
  providerId: string;
  status: "pending_review" | "applied" | "blocked_by_policy";
  changedFields: string[];
  policyDecision: PolicyDecision;
  requiredDisclosures: string[];
  createdAt: string;
};

export type DataSourceReviewStatus = "pending" | "approved" | "blocked" | "needs_legal_review";

export type DataSourceRecord = {
  id: string;
  name: string;
  sourceType: "cms" | "state_license" | "provider_website" | "rss" | "manual" | "vendor";
  baseUrl?: string;
  jurisdiction?: string;
  reviewStatus: DataSourceReviewStatus;
  robotsStatus?: string;
  termsNotes?: string;
  approvedAt?: string;
};

export type PolicyDecision =
  | "approved"
  | "approved_with_disclosure"
  | "needs_human_review"
  | "needs_legal_review"
  | "needs_expert_review"
  | "blocked"
  | "blocked_non_overridable";

export type PolicyCheckRequest = {
  subjectType: string;
  subjectId?: string;
  actionKey: string;
  input: Record<string, unknown>;
};

export type PolicyCheckResult = {
  decision: PolicyDecision;
  reasons: string[];
  requiredDisclosures: string[];
  nonOverridable: boolean;
};
