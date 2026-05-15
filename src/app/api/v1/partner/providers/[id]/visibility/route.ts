import { NextResponse } from "next/server";
import { getProviderVisibilityReport } from "@/lib/provider-dashboard/visibility-report";
import { getProviderById } from "@/lib/providers";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "providers:read", {
      eventType: "partner.providers.visibility",
      subjectType: "providers",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const report = await getProviderVisibilityReport(provider.id);

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
          generatedAt: report.generatedAt,
          scores: {
            profileCompletion: report.profileCompletionScore,
            discovery: report.discoveryScore,
            reputation: report.reputationScore,
            growthReadiness: report.growthReadinessScore,
            overall: report.overallScore
          },
          claimStatus: report.claimStatus,
          metrics: report.metrics,
          missingProfileFields: report.missingProfileFields,
          nextBestActions: report.nextBestActions.map((action) => ({
            label: action.label,
            priority: action.priority,
            reason: action.reason
          }))
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          contentRules: {
            aggregateScoresOnly: true,
            activeEntitlementKeysExcluded: true,
            internalActionUrlsExcluded: true,
            adminAuditEvidenceExcluded: true,
            claimVerificationEvidenceExcluded: true
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
