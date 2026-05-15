import { NextResponse } from "next/server";
import type { CommunityPostRecord } from "@/lib/domain/community";
import { listCommunityPosts } from "@/lib/community/feed";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  applyPartnerPagination,
  partnerAuthErrorResponse,
  partnerPaginationFromRequest,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";

const partnerCommunityPostTypes: CommunityPostRecord["postType"][] = [
  "question",
  "recommendation",
  "event",
  "provider_update",
  "expert_answer",
  "educational_tip",
  "offer",
  "safety_alert",
  "support_request"
];

function communityPostTypeFromRequest(value: string | null) {
  return partnerCommunityPostTypes.includes(value as CommunityPostRecord["postType"])
    ? (value as CommunityPostRecord["postType"])
    : undefined;
}

export async function GET(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "community:read", {
      eventType: "partner.community.posts.list",
      subjectType: "community_posts"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      city: searchParams.get("city") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      postType: communityPostTypeFromRequest(searchParams.get("postType")),
      providerId: searchParams.get("providerId") ?? undefined,
      communityId: searchParams.get("communityId") ?? undefined
    };
    const posts = await listCommunityPosts(filters);
    const pagination = partnerPaginationFromRequest(request, posts.length);

    return NextResponse.json(
      {
        data: applyPartnerPagination(posts, pagination),
        meta: {
          apiClientId: auth.client.id,
          sandboxMode: auth.client.sandboxMode,
          count: posts.length,
          filters,
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
