import { NextResponse } from "next/server";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  applyPartnerPagination,
  partnerAuthErrorResponse,
  partnerPaginationFromRequest,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";
import { listPartnerReviews } from "@/lib/reviews/reviews";

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "reviews:read", {
      eventType: "partner.reviews.list",
      subjectType: "reviews"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId") ?? undefined;
    const reviews = await listPartnerReviews({ providerId });
    const pagination = partnerPaginationFromRequest(request, reviews.length);

    return NextResponse.json(
      {
        data: applyPartnerPagination(reviews, pagination),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: reviews.length,
          filters: {
            providerId
          },
          pagination,
          responseEnvelope: partnerResponseEnvelopeMeta()
        }
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
