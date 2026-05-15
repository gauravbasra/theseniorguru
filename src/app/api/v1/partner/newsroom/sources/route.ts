import { NextResponse } from "next/server";
import type { ContentSourceRecord } from "@/lib/domain/newsroom";
import { listContentSources } from "@/lib/newsroom/newsroom";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  applyPartnerPagination,
  partnerAuthErrorResponse,
  partnerPaginationFromRequest,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

const partnerSourceTypes: ContentSourceRecord["sourceType"][] = [
  "rss",
  "manual_url",
  "interview",
  "regulatory",
  "platform_data"
];

function sourceTypeFromRequest(value: string | null) {
  return partnerSourceTypes.includes(value as ContentSourceRecord["sourceType"])
    ? (value as ContentSourceRecord["sourceType"])
    : undefined;
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "newsroom:read", {
      eventType: "partner.newsroom.sources.list",
      subjectType: "content_sources"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      sourceType: sourceTypeFromRequest(searchParams.get("sourceType")),
      q: searchParams.get("q")?.trim().toLowerCase() || undefined
    };
    const sources = (await listContentSources())
      .filter((source) => source.reviewStatus === "approved")
      .filter((source) => !filters.sourceType || source.sourceType === filters.sourceType)
      .filter((source) => {
        if (!filters.q) {
          return true;
        }

        return [source.name, source.sourceType, source.url ?? "", source.copyrightNotes ?? ""]
          .join(" ")
          .toLowerCase()
          .includes(filters.q);
      })
      .map((source) => ({
        id: source.id,
        name: source.name,
        sourceType: source.sourceType,
        url: source.url,
        attributionNotes: source.copyrightNotes,
        reviewStatus: "approved" as const,
        createdAt: source.createdAt
      }));
    const pagination = partnerPaginationFromRequest(request, sources.length);

    return NextResponse.json(
      {
        data: applyPartnerPagination(sources, pagination),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: sources.length,
          filters,
          pagination,
          contentRules: {
            approvedSourcesOnly: true,
            pendingSourcesExcluded: true,
            blockedSourcesExcluded: true,
            legalReviewSourcesExcluded: true,
            sourceItemBodiesExcluded: true
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
