export type FamilyInquiryInput = {
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  city?: string;
  state?: string;
  careType?: string;
  timeline?: string;
  budget?: string;
  message?: string;
  consentToContact: boolean;
};

export type FamilyInquiryRecord = FamilyInquiryInput & {
  id: string;
  status: "submitted" | "needs_contact_info" | "blocked_by_policy";
  policyDecision: string;
  createdAt: string;
};

export type OperatorDemoRequestInput = {
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  organizationName: string;
  role?: string;
  communityCount?: string;
  occupancyChallenge?: string;
  requestedProduct?: "ai_occupancy" | "reputation" | "growth_engine" | "full_platform";
  consentToContact: boolean;
};

export type OperatorDemoRequestRecord = OperatorDemoRequestInput & {
  id: string;
  status: "submitted" | "needs_contact_info" | "blocked_by_policy";
  policyDecision: string;
  createdAt: string;
};

export type FreeListingRequestInput = {
  communityName: string;
  contactName: string;
  contactEmail?: string;
  contactPhone?: string;
  city?: string;
  state?: string;
  websiteUrl?: string;
  careTypes?: string[];
  message?: string;
  consentToContact: boolean;
};

export type FreeListingRequestRecord = FreeListingRequestInput & {
  id: string;
  status: "submitted" | "needs_contact_info" | "blocked_by_policy";
  policyDecision: string;
  createdAt: string;
};

export type LeadQueueItem =
  | (FamilyInquiryRecord & { leadType: "family_inquiry"; displayName: string; sourceLabel: string })
  | (OperatorDemoRequestRecord & { leadType: "operator_demo"; displayName: string; sourceLabel: string })
  | (FreeListingRequestRecord & { leadType: "free_listing"; displayName: string; sourceLabel: string });

export type LeadQueueSummary = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  total: number;
  byType: Record<LeadQueueItem["leadType"], number>;
  items: LeadQueueItem[];
};
