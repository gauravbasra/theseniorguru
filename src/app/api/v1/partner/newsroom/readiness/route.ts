import { NextResponse } from "next/server";
import { getNewsroomReadiness } from "@/lib/newsroom/newsroom";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "newsroom:read", {
      eventType: "partner.newsroom.readiness",
      subjectType: "newsroom_readiness"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const readiness = await getNewsroomReadiness();

    return NextResponse.json(
      {
        data: {
          generatedAt: readiness.generatedAt,
          status: readiness.status,
          sourceRegistrySummary: readiness.sourceRegistrySummary,
          sourceSummary: readiness.sourceSummary,
          articleSummary: {
            total: readiness.articleSummary.total,
            published: readiness.articleSummary.published,
            approved: readiness.articleSummary.approved,
            pendingReview: readiness.articleSummary.pendingReview,
            blockedByPolicy: readiness.articleSummary.blockedByPolicy
          },
          derivativeSummary: readiness.derivativeSummary,
          blockers: readiness.blockers,
          nextActions: readiness.nextActions
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          contentRules: {
            aggregationOnly: true,
            draftBodiesExcluded: true,
            rawSourceItemsExcluded: true,
            adminReviewNotesExcluded: true,
            policyBlockedCountsOnly: true
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
