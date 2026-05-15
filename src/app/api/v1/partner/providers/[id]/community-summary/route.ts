import { NextResponse } from "next/server";
import { listCommunityPosts } from "@/lib/community/feed";
import { authenticatePartnerApiRequest } from "@/lib/openapi/platform";
import {
  partnerAuthErrorResponse,
  partnerResponseEnvelopeMeta,
  partnerSuccessHeaders
} from "@/lib/openapi/responses";
import { getProviderById } from "@/lib/providers";

function countBy<T>(items: T[], getKey: (item: T) => string | undefined) {
  return Object.entries(
    items.reduce<Record<string, number>>((counts, item) => {
      const key = getKey(item);

      if (key) {
        counts[key] = (counts[key] ?? 0) + 1;
      }

      return counts;
    }, {})
  )
    .map(([key, count]) => ({ key, count }))
    .sort((left, right) => right.count - left.count || left.key.localeCompare(right.key));
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const auth = await authenticatePartnerApiRequest(request, "community:read", {
      eventType: "partner.providers.community_summary",
      subjectType: "community_posts",
      subjectId: id
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const provider = await getProviderById(id);

    if (!provider) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404, headers: partnerSuccessHeaders(auth) });
    }

    const posts = await listCommunityPosts({ providerId: provider.id });

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
          generatedAt: new Date().toISOString(),
          summary: {
            publishedPosts: posts.length,
            sponsoredPosts: posts.filter((post) => post.isSponsored).length,
            organicPosts: posts.filter((post) => !post.isSponsored).length,
            postsByType: countBy(posts, (post) => post.postType),
            postsByLocation: countBy(posts, (post) =>
              post.city || post.state ? [post.city, post.state].filter(Boolean).join(", ") : undefined
            ),
            latestPublishedAt: posts[0]?.createdAt
          },
          recentPosts: posts.slice(0, 10).map((post) => ({
            id: post.id,
            communityId: post.communityId,
            postType: post.postType,
            title: post.title,
            city: post.city,
            state: post.state,
            isSponsored: post.isSponsored,
            disclosureLabel: post.disclosureLabel,
            createdAt: post.createdAt
          }))
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
            providerScopedPublishedPostsOnly: true,
            sponsorshipDisclosuresPreserved: true,
            authorIdentityExcluded: true,
            bodyTextExcluded: true,
            moderationStatusExcluded: true,
            commentsExcluded: true,
            memberIdentityExcluded: true
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
