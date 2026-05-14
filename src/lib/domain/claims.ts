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

export type ProviderClaimDecisionInput = {
  claimId: string;
  decision: "approved" | "rejected";
  adminNotes?: string;
  actorId?: string;
};

export type ProviderVerificationMethod =
  | "business_email"
  | "business_phone"
  | "license_document"
  | "domain_dns"
  | "admin_manual";

export type ProviderVerificationAttemptStatus = "pending" | "passed" | "failed" | "expired";

export type ProviderVerificationAttemptRecord = {
  id: string;
  providerClaimId: string;
  method: ProviderVerificationMethod;
  status: ProviderVerificationAttemptStatus;
  target?: string;
  attemptPayload: Record<string, unknown>;
  expiresAt?: string;
  completedAt?: string;
  createdAt: string;
};

export type CreateProviderVerificationAttemptInput = {
  claimId: string;
  method: ProviderVerificationMethod;
  target?: string;
  attemptPayload?: Record<string, unknown>;
  expiresAt?: string;
  actorId?: string;
};

export type CompleteProviderVerificationAttemptInput = {
  attemptId: string;
  status: Exclude<ProviderVerificationAttemptStatus, "pending">;
  evidence?: Record<string, unknown>;
  actorId?: string;
};

export type SendProviderVerificationAttemptInput = {
  attemptId: string;
  channel?: "email" | "sms" | "phone" | "manual";
  target?: string;
  messageTemplate?: string;
  actorId?: string;
};

export type ProviderVerificationDeliveryRecord = {
  attemptId: string;
  status: "queued" | "sent" | "manual_required";
  channel: "email" | "sms" | "phone" | "manual";
  target?: string;
  actionUrl: string;
  deliveryPayload: Record<string, unknown>;
  sentAt?: string;
};

export type ProviderVerificationCodeDeliveryRecord = ProviderVerificationDeliveryRecord & {
  codeExpiresAt: string;
  manualCode?: string;
  maskedCode: string;
};

export type IssueProviderVerificationCodeInput = {
  attemptId: string;
  channel?: "email" | "sms" | "phone";
  target?: string;
  actorId?: string;
};

export type ConfirmProviderVerificationCodeInput = {
  attemptId: string;
  code: string;
  actorId?: string;
};

export type ProviderVerificationExpiryResult = {
  generatedAt: string;
  expired: number;
  attempts: ProviderVerificationAttemptRecord[];
};

export type SubmitProviderClaimEvidenceInput = {
  claimId: string;
  method?: ProviderVerificationMethod;
  evidence: {
    evidenceType?: "business_email" | "business_phone" | "license_document" | "domain_dns" | "admin_attestation";
    submittedBy?: string;
    note?: string;
    documentUrl?: string;
    phoneLast4?: string;
    emailDomain?: string;
    attestationAccepted?: boolean;
  };
  actorId?: string;
};

export type ProviderClaimDocumentReviewDecision = "approved" | "rejected";

export type ProviderClaimDocumentReviewInput = {
  claimId: string;
  attemptId?: string;
  decision: ProviderClaimDocumentReviewDecision;
  reviewerId?: string;
  reviewerNotes?: string;
  evidence: {
    documentUrl?: string;
    documentType?: "license" | "certification" | "insurance" | "state_registration" | "other";
    issuingAuthority?: string;
    licenseNumberLast4?: string;
    expirationDate?: string;
    matchedProviderName?: boolean;
    matchedProviderAddress?: boolean;
    attestationAccepted?: boolean;
  };
};

export type ProviderClaimDocumentReviewRecord = {
  id: string;
  claimId: string;
  attemptId?: string;
  decision: ProviderClaimDocumentReviewDecision;
  reviewerId?: string;
  reviewerNotes?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
};

export type ProviderClaimChecklistItem = {
  key: string;
  label: string;
  status: "not_started" | "pending" | "passed" | "failed" | "expired" | "not_required";
  method?: ProviderVerificationMethod;
  target?: string;
  attemptId?: string;
  completedAt?: string;
};

export type ProviderClaimStatusSummary = {
  claim: ProviderClaimRecord;
  checklist: ProviderClaimChecklistItem[];
  nextAction: string;
  readyForAdminReview: boolean;
  canEditProfile: boolean;
};

export type ProviderVerificationQueueItem = {
  claim: ProviderClaimRecord;
  statusSummary: ProviderClaimStatusSummary;
  latestAttempt?: ProviderVerificationAttemptRecord;
  queueStatus:
    | "ready_for_admin_review"
    | "needs_verification_start"
    | "pending_delivery"
    | "pending_provider_action"
    | "failed_or_expired"
    | "approved"
    | "rejected";
  priority: "low" | "medium" | "high" | "critical";
  ageHours: number;
  nextAction: string;
};

export type ProviderVerificationQueueSummary = {
  generatedAt: string;
  totals: {
    claims: number;
    readyForAdminReview: number;
    needsVerificationStart: number;
    pendingDelivery: number;
    pendingProviderAction: number;
    failedOrExpired: number;
    approved: number;
    rejected: number;
  };
  items: ProviderVerificationQueueItem[];
  blockers: string[];
  nextActions: string[];
};

export type ProviderVerificationSlaItem = {
  claimId: string;
  providerId: string;
  claimantEmail: string;
  claimStatus: ProviderClaimStatus;
  queueStatus: ProviderVerificationQueueItem["queueStatus"];
  priority: ProviderVerificationQueueItem["priority"];
  ageHours: number;
  attemptId?: string;
  method?: ProviderVerificationMethod;
  target?: string;
  attemptStatus?: ProviderVerificationAttemptStatus;
  dueAt?: string;
  hoursUntilDue?: number;
  hoursOverdue?: number;
  nextAction: string;
};

export type ProviderVerificationSlaSummary = {
  generatedAt: string;
  status: "ready" | "attention_needed" | "blocked";
  slaHours: {
    startVerification: number;
    sendDelivery: number;
    providerResponse: number;
    adminReview: number;
  };
  totals: {
    claims: number;
    notStarted: number;
    pendingDelivery: number;
    dueSoon: number;
    overdue: number;
    failedOrExpired: number;
    readyForAdminReview: number;
  };
  overdue: ProviderVerificationSlaItem[];
  dueSoon: ProviderVerificationSlaItem[];
  pendingDelivery: ProviderVerificationSlaItem[];
  failedOrExpired: ProviderVerificationSlaItem[];
  readyForAdminReview: ProviderVerificationSlaItem[];
  blockers: string[];
  nextActions: string[];
};

export type NotifyProviderVerificationSlaAlertsInput = {
  dryRun?: boolean;
  deliveryProvider?: "manual_export" | "internal_notification_queue";
  actorId?: string;
};

export type ProviderVerificationSlaAlertResult = {
  generatedAt: string;
  dryRun: boolean;
  deliveryProvider: "manual_export" | "internal_notification_queue";
  status: "ready" | "blocked" | "sent" | "no_action";
  recipients: string[];
  slaSummary: ProviderVerificationSlaSummary;
  payloadPreview: {
    subject: string;
    alertCount: number;
    overdue: number;
    dueSoon: number;
    pendingDelivery: number;
    failedOrExpired: number;
    readyForAdminReview: number;
    items: ProviderVerificationSlaItem[];
  };
  blockers: string[];
  nextActions: string[];
};

export type ProviderOnboardingReadinessSummary = {
  generatedAt: string;
  providerId: string;
  providerName: string;
  status: "ready" | "action_required" | "blocked";
  stages: {
    listing: {
      status: "ready" | "action_required";
      providerStatus: string;
      sourceConfidence: number;
    };
    outreach: {
      status: "not_started" | "queued" | "sent" | "blocked";
      total: number;
      queued: number;
      sent: number;
      blocked: number;
    };
    claim: {
      status: ProviderClaimStatus | "not_started";
      total: number;
      latestClaimId?: string;
      readyForAdminReview: boolean;
      canEditProfile: boolean;
    };
    verification: {
      total: number;
      pending: number;
      passed: number;
      failed: number;
      expired: number;
    };
    reputation: {
      status: "ready" | "action_required" | "blocked";
      publishedReviews: number;
      queuedRequests: number;
      blockers: string[];
    };
    growth: {
      status: "not_started" | "pending_contract" | "active" | "blocked";
      subscriptions: number;
      activeSubscriptions: number;
      activeEntitlements: string[];
    };
  };
  blockers: string[];
  nextActions: string[];
};
