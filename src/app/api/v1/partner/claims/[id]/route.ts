import { NextResponse } from "next/server";
import { getProviderClaimStatusSummary } from "@/lib/claims/claim-status";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import { partnerAuthErrorResponse, partnerResponseEnvelopeMeta, partnerSuccessHeaders } from "@/lib/openapi/responses";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "claims:write", {
      eventType: "partner.claims.status",
      subjectType: "provider_claim",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const claimantEmail = new URL(request.url).searchParams.get("claimantEmail")?.trim().toLowerCase();

    if (!claimantEmail) {
      return NextResponse.json(
        { error: "claimantEmail is required to retrieve partner claim status" },
        { status: 422, headers: partnerSuccessHeaders(auth) }
      );
    }

    const statusSummary = await getProviderClaimStatusSummary(id);

    if (statusSummary.claim.claimantEmail.toLowerCase() !== claimantEmail) {
      return NextResponse.json(
        { error: "Claimant email does not match the requested claim" },
        { status: 403, headers: partnerSuccessHeaders(auth) }
      );
    }

    return NextResponse.json(
      {
        data: statusSummary,
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Provider claim not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
