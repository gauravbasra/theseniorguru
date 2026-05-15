import { NextResponse } from "next/server";
import { submitProviderClaimEvidence } from "@/lib/claims/claim-evidence";
import { getProviderClaimStatusSummary } from "@/lib/claims/claim-status";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import { partnerAuthErrorResponse, partnerResponseEnvelopeMeta, partnerSuccessHeaders } from "@/lib/openapi/responses";

type ClaimStatusSummary = Awaited<ReturnType<typeof getProviderClaimStatusSummary>>;

function errorStatus(message: string) {
  if (message === "Provider claim not found") {
    return 404;
  }

  if (message.includes("must be true") || message.includes("evidence is required") || message.includes("claimantEmail is required")) {
    return 422;
  }

  if (message.includes("already completed") || message.includes("has expired") || message.includes("already decided")) {
    return 409;
  }

  return 500;
}

function partnerSafeStatusSummary(statusSummary: ClaimStatusSummary) {
  return {
    claim: statusSummary.claim,
    checklist: statusSummary.checklist.map(({ attemptId: _attemptId, target: _target, ...item }) => item),
    nextAction: statusSummary.nextAction,
    readyForAdminReview: statusSummary.readyForAdminReview,
    canEditProfile: statusSummary.canEditProfile
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "claims:write", {
      eventType: "partner.claims.verification_evidence",
      subjectType: "provider_claim",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const body = await request.json();
    const claimantEmail =
      typeof body.claimantEmail === "string" ? body.claimantEmail.trim().toLowerCase() : "";

    if (!claimantEmail) {
      return NextResponse.json(
        { error: "claimantEmail is required to submit partner claim evidence" },
        { status: 422, headers: partnerSuccessHeaders(auth) }
      );
    }

    if (!body.evidence) {
      return NextResponse.json({ error: "evidence is required" }, { status: 422, headers: partnerSuccessHeaders(auth) });
    }

    const beforeSummary = await getProviderClaimStatusSummary(id);

    if (beforeSummary.claim.claimantEmail.toLowerCase() !== claimantEmail) {
      return NextResponse.json(
        { error: "Claimant email does not match the requested claim" },
        { status: 403, headers: partnerSuccessHeaders(auth) }
      );
    }

    const result = await submitProviderClaimEvidence({
      claimId: id,
      method: body.method,
      evidence: {
        evidenceType: body.evidence.evidenceType,
        submittedBy: body.evidence.submittedBy,
        note: body.evidence.note,
        documentUrl: body.evidence.documentUrl,
        phoneLast4: body.evidence.phoneLast4,
        emailDomain: body.evidence.emailDomain,
        attestationAccepted: body.evidence.attestationAccepted
      },
      actorId: body.actorId
    });
    const statusSummary = await getProviderClaimStatusSummary(id);

    return NextResponse.json(
      {
        data: {
          verificationAttempt: {
            method: result.method,
            status: result.status,
            completedAt: result.completedAt,
            createdAt: result.createdAt
          },
          statusSummary: partnerSafeStatusSummary(statusSummary)
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          contentRules: {
            claimantEmailMatchRequired: true,
            attestationRequired: true,
            verificationAttemptIdExcluded: true,
            verificationTargetExcluded: true,
            rawAttemptPayloadExcluded: true,
            rawEvidencePayloadExcluded: true,
            policyDecisionExcluded: true
          },
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { status: 201, headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}
