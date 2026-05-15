import { NextResponse } from "next/server";
import { getProviderClaimStatusSummary } from "@/lib/claims/claim-status";
import { submitProviderClaim } from "@/lib/claims/provider-claims";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import { partnerAuthErrorResponse, partnerResponseEnvelopeMeta, partnerSuccessHeaders } from "@/lib/openapi/responses";

export async function POST(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "claims:write", {
      eventType: "partner.claims.submit",
      subjectType: "provider_claim"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const body = await request.json();

    if (!body.providerId || !body.claimantName || !body.claimantEmail) {
      return NextResponse.json(
        { error: "providerId, claimantName, and claimantEmail are required" },
        { status: 422, headers: partnerSuccessHeaders(auth) }
      );
    }

    const claim = await submitProviderClaim({
      providerId: body.providerId,
      claimantName: body.claimantName,
      claimantEmail: body.claimantEmail,
      claimantPhone: body.claimantPhone,
      claimantRole: body.claimantRole,
      businessDomain: body.businessDomain
    });
    const statusSummary = await getProviderClaimStatusSummary(claim.id);

    return NextResponse.json(
      {
        data: {
          claim,
          statusSummary
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { status: 201, headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Provider not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
