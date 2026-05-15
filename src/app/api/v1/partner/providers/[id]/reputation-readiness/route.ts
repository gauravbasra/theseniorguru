import { NextResponse } from "next/server";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";
import { getProviderById } from "@/lib/providers";
import { getProviderReputationReadiness } from "@/lib/reviews/reputation-readiness";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "reviews:read", {
      eventType: "partner.providers.reputation_readiness",
      subjectType: "reviews",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const readiness = await getProviderReputationReadiness(provider.id);

    return NextResponse.json(
      {
        data: {
          provider: {
            id: provider.id,
            slug: provider.slug,
            name: provider.name,
            status: provider.status,
            city: provider.city,
            state: provider.state
          },
          generatedAt: readiness.generatedAt,
          status: readiness.status,
          reviewSummary: readiness.reviewSummary,
          campaignSummary: readiness.campaignSummary,
          blockers: readiness.blockers,
          nextActions: readiness.nextActions
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          lookup: {
            requestedId: id,
            matchedId: provider.id,
            matchedSlug: provider.slug
          },
          contentRules: {
            aggregateReadinessOnly: true,
            reviewerIdentityExcluded: true,
            reviewModerationNotesExcluded: true,
            requestRecipientDetailsExcluded: true,
            claimVerificationEvidenceExcluded: true,
            internalActionUrlsExcluded: true
          },
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
