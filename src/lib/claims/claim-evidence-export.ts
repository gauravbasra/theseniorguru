import type { ProviderVerificationAttemptRecord } from "@/lib/domain/claims";
import { listProviderClaimDocumentReviews } from "@/lib/claims/document-review";
import { getProviderClaimStatusSummary } from "@/lib/claims/claim-status";
import { listProviderVerificationAttempts } from "@/lib/claims/provider-verification";

export type ProviderClaimEvidenceExportFormat = "json" | "csv";

type ProviderClaimEvidenceRow = {
  section: "claim" | "checklist" | "attempt" | "document_review" | "blocker" | "next_action";
  key: string;
  status: string;
  method?: string;
  target?: string;
  createdAt?: string;
  completedAt?: string;
  evidenceSummary?: string;
};

export type ProviderClaimEvidenceExport = {
  generatedAt: string;
  claimId: string;
  providerId: string;
  status: "ready_for_approval" | "needs_verification" | "approved" | "rejected";
  readyForAdminReview: boolean;
  canEditProfile: boolean;
  totals: {
    checklistItems: number;
    attempts: number;
    passedAttempts: number;
    failedAttempts: number;
    pendingAttempts: number;
    expiredAttempts: number;
    documentReviews: number;
    approvedDocumentReviews: number;
    rejectedDocumentReviews: number;
  };
  rows: ProviderClaimEvidenceRow[];
  blockers: string[];
  nextActions: string[];
  csv?: string;
};

function csvEscape(value: unknown) {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function rowsToCsv(rows: ProviderClaimEvidenceRow[]) {
  const headers = ["section", "key", "status", "method", "target", "createdAt", "completedAt", "evidenceSummary"];
  return [
    headers.join(","),
    ...rows.map((row) =>
      [
        row.section,
        row.key,
        row.status,
        row.method ?? "",
        row.target ?? "",
        row.createdAt ?? "",
        row.completedAt ?? "",
        row.evidenceSummary ?? ""
      ]
        .map(csvEscape)
        .join(",")
    )
  ].join("\n");
}

function summarizeEvidence(attempt: ProviderVerificationAttemptRecord) {
  const evidence = attempt.attemptPayload.completionEvidence;

  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    return attempt.status === "pending" ? "No completion evidence submitted yet." : "No structured completion evidence recorded.";
  }

  const payload = evidence as Record<string, unknown>;
  const keys = Object.keys(payload)
    .filter((key) => !["documentUrl", "note", "reviewerNotes"].includes(key))
    .sort();
  const signals = [
    payload.attestationAccepted === true ? "attestation accepted" : undefined,
    typeof payload.emailDomain === "string" ? `email domain ${payload.emailDomain}` : undefined,
    typeof payload.phoneLast4 === "string" ? `phone last4 ${payload.phoneLast4}` : undefined,
    typeof payload.licenseNumberLast4 === "string" ? `license last4 ${payload.licenseNumberLast4}` : undefined,
    payload.documentUrl ? "document reference supplied" : undefined,
    typeof payload.policyDecision === "string" ? `policy ${payload.policyDecision}` : undefined
  ].filter((item): item is string => Boolean(item));

  return signals.length ? signals.join("; ") : `Structured evidence keys: ${keys.join(", ") || "none"}.`;
}

function documentReviewEvidenceSummary(evidence: Record<string, unknown>) {
  const signals = [
    evidence.attestationAccepted === true ? "attestation accepted" : undefined,
    typeof evidence.documentType === "string" ? `document type ${evidence.documentType}` : undefined,
    typeof evidence.issuingAuthority === "string" ? `issuing authority ${evidence.issuingAuthority}` : undefined,
    typeof evidence.licenseNumberLast4 === "string" ? `license last4 ${evidence.licenseNumberLast4}` : undefined,
    evidence.documentUrl ? "document reference supplied" : undefined,
    evidence.matchedProviderName === true ? "provider name matched" : undefined,
    evidence.matchedProviderAddress === true ? "provider address matched" : undefined,
    typeof evidence.policyDecision === "string" ? `policy ${evidence.policyDecision}` : undefined
  ].filter((item): item is string => Boolean(item));

  return signals.length ? signals.join("; ") : "No structured document review evidence recorded.";
}

function decideExportStatus(summary: Awaited<ReturnType<typeof getProviderClaimStatusSummary>>, passedAttempts: number) {
  if (summary.claim.status === "approved") return "approved";
  if (summary.claim.status === "rejected") return "rejected";
  if (summary.readyForAdminReview || passedAttempts > 0) return "ready_for_approval";
  return "needs_verification";
}

export async function exportProviderClaimEvidence(
  claimId: string,
  format: ProviderClaimEvidenceExportFormat = "json"
): Promise<ProviderClaimEvidenceExport> {
  const [summary, attempts, documentReviews] = await Promise.all([
    getProviderClaimStatusSummary(claimId),
    listProviderVerificationAttempts(claimId),
    listProviderClaimDocumentReviews(claimId)
  ]);
  const passedAttempts = attempts.filter((attempt) => attempt.status === "passed").length;
  const failedAttempts = attempts.filter((attempt) => attempt.status === "failed").length;
  const pendingAttempts = attempts.filter((attempt) => attempt.status === "pending").length;
  const expiredAttempts = attempts.filter((attempt) => attempt.status === "expired").length;
  const approvedDocumentReviews = documentReviews.filter((review) => review.decision === "approved").length;
  const rejectedDocumentReviews = documentReviews.filter((review) => review.decision === "rejected").length;
  const blockers = [
    ...(attempts.length ? [] : ["No verification attempts exist for this claim."]),
    ...(passedAttempts ? [] : ["No passed verification attempt exists for this claim."]),
    ...(summary.claim.status === "rejected" ? ["Rejected claims require a new claim or reopened evidence path before approval."] : [])
  ];
  const nextActions = [
    ...(blockers.length ? ["Resolve claim verification blockers before approving or counting this provider as claimed."] : []),
    ...(passedAttempts && summary.claim.status !== "approved"
      ? ["Approve or reject the claim from the admin claim queue using this evidence export."]
      : []),
    ...(summary.claim.status === "approved" ? ["Provider portal profile edits can continue through governed review."] : [])
  ];
  const rows: ProviderClaimEvidenceRow[] = [
    {
      section: "claim",
      key: summary.claim.id,
      status: summary.claim.status,
      method: summary.claim.verificationMethod,
      target: summary.claim.businessDomain ?? summary.claim.claimantEmail,
      createdAt: summary.claim.createdAt,
      evidenceSummary: `Claimant ${summary.claim.claimantName}; role ${summary.claim.claimantRole ?? "not supplied"}.`
    },
    ...summary.checklist.map((item) => ({
      section: "checklist" as const,
      key: item.key,
      status: item.status,
      method: item.method,
      target: item.target,
      completedAt: item.completedAt,
      evidenceSummary: item.label
    })),
    ...attempts.map((attempt) => ({
      section: "attempt" as const,
      key: attempt.id,
      status: attempt.status,
      method: attempt.method,
      target: attempt.target,
      createdAt: attempt.createdAt,
      completedAt: attempt.completedAt,
      evidenceSummary: summarizeEvidence(attempt)
    })),
    ...documentReviews.map((review) => ({
      section: "document_review" as const,
      key: review.id,
      status: review.decision,
      method: "license_document",
      createdAt: review.createdAt,
      completedAt: review.createdAt,
      evidenceSummary: documentReviewEvidenceSummary(review.evidence)
    })),
    ...blockers.map((blocker) => ({
      section: "blocker" as const,
      key: "claim_verification_blocker",
      status: "blocked",
      evidenceSummary: blocker
    })),
    ...nextActions.map((action) => ({
      section: "next_action" as const,
      key: "claim_verification_next_action",
      status: "open",
      evidenceSummary: action
    }))
  ];
  const result: ProviderClaimEvidenceExport = {
    generatedAt: new Date().toISOString(),
    claimId,
    providerId: summary.claim.providerId,
    status: decideExportStatus(summary, passedAttempts),
    readyForAdminReview: summary.readyForAdminReview,
    canEditProfile: summary.canEditProfile,
    totals: {
      checklistItems: summary.checklist.length,
      attempts: attempts.length,
      passedAttempts,
      failedAttempts,
      pendingAttempts,
      expiredAttempts,
      documentReviews: documentReviews.length,
      approvedDocumentReviews,
      rejectedDocumentReviews
    },
    rows,
    blockers,
    nextActions
  };

  return format === "csv" ? { ...result, csv: rowsToCsv(rows) } : result;
}
