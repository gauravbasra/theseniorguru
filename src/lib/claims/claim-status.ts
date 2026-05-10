import type {
  ProviderClaimChecklistItem,
  ProviderClaimStatusSummary,
  ProviderVerificationAttemptRecord,
  ProviderVerificationMethod
} from "@/lib/domain/claims";
import { getProviderClaimById } from "@/lib/claims/provider-claims";
import { listProviderVerificationAttempts } from "@/lib/claims/provider-verification";

const checklistDefinitions: Array<{ key: string; label: string; method: ProviderVerificationMethod }> = [
  { key: "business_email", label: "Confirm business email or domain", method: "business_email" },
  { key: "business_phone", label: "Confirm business phone", method: "business_phone" },
  { key: "license_document", label: "Upload license or ownership document", method: "license_document" },
  { key: "admin_manual", label: "Admin review and approval", method: "admin_manual" }
];

function latestAttemptForMethod(
  attempts: ProviderVerificationAttemptRecord[],
  method: ProviderVerificationMethod
): ProviderVerificationAttemptRecord | undefined {
  return attempts
    .filter((attempt) => attempt.method === method)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
}

function buildChecklist(attempts: ProviderVerificationAttemptRecord[]): ProviderClaimChecklistItem[] {
  return checklistDefinitions.map((definition) => {
    const attempt = latestAttemptForMethod(attempts, definition.method);

    if (!attempt) {
      return {
        key: definition.key,
        label: definition.label,
        status: definition.method === "admin_manual" ? "pending" : "not_started",
        method: definition.method
      };
    }

    return {
      key: definition.key,
      label: definition.label,
      status: attempt.status,
      method: definition.method,
      target: attempt.target,
      attemptId: attempt.id,
      completedAt: attempt.completedAt
    };
  });
}

function getNextAction(checklist: ProviderClaimChecklistItem[], approved: boolean) {
  if (approved) {
    return "Claim approved. Provider profile editing can proceed through the provider portal review workflow.";
  }

  const failed = checklist.find((item) => item.status === "failed" || item.status === "expired");

  if (failed) {
    return `Resolve failed verification: ${failed.label}.`;
  }

  const notStarted = checklist.find((item) => item.status === "not_started");

  if (notStarted) {
    return `Start verification: ${notStarted.label}.`;
  }

  return "Verification is pending admin review.";
}

export async function getProviderClaimStatusSummary(claimId: string): Promise<ProviderClaimStatusSummary> {
  const claim = await getProviderClaimById(claimId);

  if (!claim) {
    throw new Error("Provider claim not found");
  }

  const attempts = await listProviderVerificationAttempts(claimId);
  const checklist = buildChecklist(attempts);
  const readyForAdminReview =
    claim.status === "admin_review" ||
    checklist.some((item) => item.status === "passed") ||
    checklist.every((item) => item.status === "passed" || item.status === "not_required");
  const approved = claim.status === "approved";

  return {
    claim,
    checklist,
    nextAction: getNextAction(checklist, approved),
    readyForAdminReview,
    canEditProfile: approved
  };
}
