export type ProviderClaimStatus =
  | "submitted"
  | "email_pending"
  | "phone_pending"
  | "document_pending"
  | "admin_review"
  | "approved"
  | "rejected"
  | "conflict";

export type ProviderClaimInput = {
  providerId: string;
  claimantName: string;
  claimantEmail: string;
  claimantPhone?: string;
  claimantRole?: string;
  businessDomain?: string;
};

export type ProviderClaimRecord = ProviderClaimInput & {
  id: string;
  status: ProviderClaimStatus;
  verificationMethod?: "business_email" | "business_phone" | "license_document" | "domain_dns" | "admin_manual";
  policyCheckId?: string;
  createdAt: string;
  updatedAt?: string;
};

