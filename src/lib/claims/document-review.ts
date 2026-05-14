import type {
  ProviderClaimDocumentReviewInput,
  ProviderClaimDocumentReviewRecord,
  ProviderVerificationAttemptRecord
} from "@/lib/domain/claims";
import { getProviderClaimById } from "@/lib/claims/provider-claims";
import {
  completeProviderVerificationAttempt,
  createProviderVerificationAttempt,
  listProviderVerificationAttempts
} from "@/lib/claims/provider-verification";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedDocumentReviews: ProviderClaimDocumentReviewRecord[] = [];

function mapDocumentReview(row: Record<string, unknown>): ProviderClaimDocumentReviewRecord {
  return {
    id: String(row.id),
    claimId: String(row.provider_claim_id),
    attemptId: row.provider_verification_attempt_id ? String(row.provider_verification_attempt_id) : undefined,
    decision: row.decision as ProviderClaimDocumentReviewRecord["decision"],
    reviewerId: row.reviewer_id ? String(row.reviewer_id) : undefined,
    reviewerNotes: row.reviewer_notes ? String(row.reviewer_notes) : undefined,
    evidence:
      row.evidence_payload && typeof row.evidence_payload === "object" && !Array.isArray(row.evidence_payload)
        ? (row.evidence_payload as Record<string, unknown>)
        : {},
    createdAt: String(row.created_at)
  };
}

function latestPendingDocumentAttempt(attempts: ProviderVerificationAttemptRecord[]) {
  const now = Date.now();

  return attempts
    .filter((attempt) => attempt.method === "license_document")
    .filter((attempt) => attempt.status === "pending")
    .filter((attempt) => !attempt.expiresAt || Date.parse(attempt.expiresAt) > now)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
}

function assertReviewInput(input: ProviderClaimDocumentReviewInput) {
  if (input.decision !== "approved" && input.decision !== "rejected") {
    throw new Error("decision must be approved or rejected");
  }

  if (!input.evidence?.attestationAccepted) {
    throw new Error("attestationAccepted must be true before document review");
  }

  if (input.decision === "approved") {
    const hasDocumentReference = Boolean(input.evidence.documentUrl || input.evidence.licenseNumberLast4);

    if (!hasDocumentReference) {
      throw new Error("approved document review requires documentUrl or licenseNumberLast4");
    }
  }
}

async function resolveDocumentAttempt(input: ProviderClaimDocumentReviewInput) {
  const attempts = await listProviderVerificationAttempts(input.claimId);

  if (input.attemptId) {
    const attempt = attempts.find((item) => item.id === input.attemptId);

    if (!attempt) {
      throw new Error("Provider verification attempt not found");
    }

    if (attempt.method !== "license_document") {
      throw new Error("document review requires a license_document verification attempt");
    }

    return attempt;
  }

  return (
    latestPendingDocumentAttempt(attempts) ??
    createProviderVerificationAttempt({
      claimId: input.claimId,
      method: "license_document",
      target: input.evidence.documentUrl,
      attemptPayload: { source: "admin_document_review" },
      actorId: input.reviewerId
    })
  );
}

export async function reviewProviderClaimDocument(
  input: ProviderClaimDocumentReviewInput
): Promise<{ review: ProviderClaimDocumentReviewRecord; attempt: ProviderVerificationAttemptRecord }> {
  assertReviewInput(input);

  const claim = await getProviderClaimById(input.claimId);

  if (!claim) {
    throw new Error("Provider claim not found");
  }

  if (claim.status === "approved" || claim.status === "rejected") {
    throw new Error("Provider claim is already decided");
  }

  const policy = await runPolicyCheck({
    subjectType: "provider_claim_document_review",
    subjectId: input.claimId,
    actionKey: "review_provider_claim_document",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Provider claim document review blocked by policy");
  }

  const attempt = await resolveDocumentAttempt(input);
  const completedAttempt = await completeProviderVerificationAttempt({
    attemptId: attempt.id,
    status: input.decision === "approved" ? "passed" : "failed",
    evidence: {
      ...input.evidence,
      evidenceType: "license_document",
      reviewerNotes: input.reviewerNotes,
      reviewedAt: new Date().toISOString(),
      policyDecision: policy.decision
    },
    actorId: input.reviewerId
  });

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const evidencePayload = {
    ...input.evidence,
    policyDecision: policy.decision,
    completedAttemptStatus: completedAttempt.status
  };

  if (!supabase) {
    const review: ProviderClaimDocumentReviewRecord = {
      id: `document-review-${Date.now()}`,
      claimId: input.claimId,
      attemptId: attempt.id,
      decision: input.decision,
      reviewerId: input.reviewerId,
      reviewerNotes: input.reviewerNotes,
      evidence: evidencePayload,
      createdAt: now
    };
    seedDocumentReviews.unshift(review);
    return { review, attempt: completedAttempt };
  }

  const { data, error } = await supabase
    .from("provider_claim_document_reviews")
    .insert({
      provider_claim_id: input.claimId,
      provider_verification_attempt_id: attempt.id,
      decision: input.decision,
      reviewer_id: input.reviewerId,
      reviewer_notes: input.reviewerNotes,
      evidence_payload: evidencePayload
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Provider claim document review persistence failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.reviewerId,
    actor_type: input.reviewerId ? "admin" : "system",
    event_type: `provider_claim_document_review.${input.decision}`,
    subject_type: "provider_claim",
    subject_id: input.claimId,
    payload: {
      attemptId: attempt.id,
      reviewerNotes: input.reviewerNotes,
      policyDecision: policy.decision
    }
  });

  return { review: mapDocumentReview(data), attempt: completedAttempt };
}
