export type ProviderContactIntent = {
  providerId: string;
  requesterName: string;
  requesterEmail?: string;
  requesterPhone?: string;
  relationship?: "myself" | "spouse" | "relative" | "friend" | "professional" | "other";
  payingWith?: "insurance" | "private_pay" | "medicaid" | "medicare" | "other" | "unknown";
  message?: string;
  consentToContact: boolean;
};

export type ProviderContactRecord = ProviderContactIntent & {
  id: string;
  status: "submitted" | "needs_contact_info" | "blocked_by_policy";
  policyDecision: string;
  createdAt: string;
};
