import type {
  ProviderVerificationAttemptRecord,
  SubmitProviderClaimEvidenceInput
} from "@/lib/domain/claims";
import { getProviderClaimById } from "@/lib/claims/provider-claims";
import {
  completeProviderVerificationAttempt,
  createProviderVerificationAttempt,
  listProviderVerificationAttempts
} from "@/lib/claims/provider-verification";
import { runPolicyCheck } from "@/lib/policy";

function latestPendingAttempt(attempts: ProviderVerificationAttemptRecord[], method?: string) {
  return attempts
    .filter((attempt) => attempt.status === "pending")
    .filter((attempt) => !method || attempt.method === method)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

export async function submitProviderClaimEvidence(input: SubmitProviderClaimEvidenceInput) {
  const claim = await getProviderClaimById(input.claimId);

  if (!claim) {
    throw new Error("Provider claim not found");
  }

  if (claim.status === "approved" || claim.status === "rejected") {
    throw new Error("Provider claim is already decided");
  }

  if (!input.evidence.attestationAccepted) {
    throw new Error("attestationAccepted must be true before evidence submission");
  }

  const policy = await runPolicyCheck({
    subjectType: "provider_claim_evidence",
    subjectId: input.claimId,
    actionKey: "submit_provider_claim_evidence",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider claim evidence blocked by policy");
  }

  const attempts = await listProviderVerificationAttempts(input.claimId);
  const method = input.method ?? claim.verificationMethod ?? "admin_manual";
  const attempt =
    latestPendingAttempt(attempts, method) ??
    (await createProviderVerificationAttempt({
      claimId: input.claimId,
      method,
      target: claim.businessDomain ?? claim.claimantEmail,
      attemptPayload: { source: "claim_evidence_submission" },
      actorId: input.actorId
    }));

  return completeProviderVerificationAttempt({
    attemptId: attempt.id,
    status: "passed",
    evidence: {
      ...input.evidence,
      policyDecision: policy.decision,
      submittedAt: new Date().toISOString()
    },
    actorId: input.actorId
  });
}
