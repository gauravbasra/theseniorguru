import { NextResponse } from "next/server";
import type { ContentPerformanceSubjectType } from "@/lib/domain/newsroom";
import { getContentPerformanceSummary } from "@/lib/newsroom/newsroom";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

const partnerSubjectTypes: ContentPerformanceSubjectType[] = ["article", "newsletter"];

function subjectTypeFromRequest(value: string | null) {
  return partnerSubjectTypes.includes(value as ContentPerformanceSubjectType)
    ? (value as ContentPerformanceSubjectType)
    : undefined;
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "newsroom:read", {
      eventType: "partner.newsroom.performance.summary",
      subjectType: "content_performance"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      subjectType: subjectTypeFromRequest(searchParams.get("subjectType")),
      subjectId: searchParams.get("subjectId")?.trim() || undefined,
      channel: searchParams.get("channel")?.trim() || undefined
    };
    const summary = await getContentPerformanceSummary(filters);

    return NextResponse.json(
      {
        data: {
          generatedAt: summary.generatedAt,
          filters: summary.filters,
          totals: summary.totals,
          byChannel: summary.byChannel,
          topContent: summary.topContent.filter((item) => partnerSubjectTypes.includes(item.subjectType)),
          nextActions: summary.nextActions
        },
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          contentRules: {
            aggregationOnly: true,
            allowedSubjectTypes: partnerSubjectTypes,
            rawMetricPayloadExcluded: true,
            recipientDetailsExcluded: true,
            draftAndPolicyBlockedContentExcluded: true
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
