import type { AppFeedItem, CommunityPostRecord } from "@/lib/domain/community";
import { listEvents } from "@/lib/events/events";
import { listProviders } from "@/lib/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedCommunityPosts: CommunityPostRecord[] = [
  {
    id: "seed-caregiver-question",
    postType: "question",
    status: "published",
    title: "What should I ask on a first memory care tour?",
    body: "Families often compare safety, staffing, activities, and communication style first.",
    city: "Denver",
    state: "CO",
    isSponsored: false,
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];

function mapCommunityPost(row: Record<string, unknown>): CommunityPostRecord {
  return {
    id: String(row.id),
    communityId: row.community_id ? String(row.community_id) : undefined,
    providerId: row.provider_id ? String(row.provider_id) : undefined,
    authorName: row.author_name ? String(row.author_name) : undefined,
    postType: row.post_type as CommunityPostRecord["postType"],
    status: row.status as CommunityPostRecord["status"],
    title: String(row.title),
    body: row.body ? String(row.body) : undefined,
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    isSponsored: Boolean(row.is_sponsored),
    disclosureLabel: row.disclosure_label ? String(row.disclosure_label) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listCommunityPosts(input: {
  city?: string;
  state?: string;
  postType?: CommunityPostRecord["postType"];
  providerId?: string;
  communityId?: string;
} = {}): Promise<CommunityPostRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedCommunityPosts
      .filter((post) => post.status === "published")
      .filter((post) => !input.city || post.city?.toLowerCase() === input.city.toLowerCase())
      .filter((post) => !input.state || post.state?.toLowerCase() === input.state.toLowerCase())
      .filter((post) => !input.postType || post.postType === input.postType)
      .filter((post) => !input.providerId || post.providerId === input.providerId)
      .filter((post) => !input.communityId || post.communityId === input.communityId);
  }

  let query = supabase
    .from("community_posts")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(50);

  if (input.city) query = query.ilike("city", input.city);
  if (input.state) query = query.ilike("state", input.state);
  if (input.postType) query = query.eq("post_type", input.postType);
  if (input.providerId) query = query.eq("provider_id", input.providerId);
  if (input.communityId) query = query.eq("community_id", input.communityId);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Community post query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCommunityPost);
}

export async function getAppFeed(): Promise<AppFeedItem[]> {
  const [providers, events, posts] = await Promise.all([listProviders(), listEvents(), listCommunityPosts()]);

  return [
    ...providers.slice(0, 8).map((provider): AppFeedItem => ({
      id: `provider-${provider.id}`,
      type: "provider",
      title: provider.name,
      subtitle: provider.categories.join(", "),
      href: `/providers/${provider.slug}`,
      city: provider.city,
      state: provider.state,
      sponsored: provider.status === "growth_partner",
      disclosureLabel: provider.status === "growth_partner" ? "Sponsored" : undefined,
      payload: provider
    })),
    ...events.slice(0, 8).map((event): AppFeedItem => ({
      id: `event-${event.id}`,
      type: "event",
      title: event.title,
      subtitle: event.eventType.replaceAll("_", " "),
      href: `/events/${event.slug}`,
      city: event.city,
      state: event.state,
      sponsored: event.status === "featured",
      disclosureLabel: event.status === "featured" ? "Sponsored" : undefined,
      payload: event
    })),
    ...posts.slice(0, 8).map((post): AppFeedItem => ({
      id: `post-${post.id}`,
      type: "community_post",
      title: post.title,
      subtitle: post.postType.replaceAll("_", " "),
      city: post.city,
      state: post.state,
      sponsored: post.isSponsored,
      disclosureLabel: post.disclosureLabel,
      payload: post
    }))
  ];
}

export function filterAppFeedForDigest(
  feedItems: AppFeedItem[],
  filters: { city?: string; state?: string; topicKey?: string }
): AppFeedItem[] {
  const city = filters.city?.trim().toLowerCase();
  const state = filters.state?.trim().toLowerCase();
  const topic = filters.topicKey?.trim().toLowerCase().replaceAll("-", " ");

  return feedItems
    .filter((item) => !city || item.city?.toLowerCase() === city)
    .filter((item) => !state || item.state?.toLowerCase() === state)
    .filter((item) => {
      if (!topic) return true;

      const searchable = [
        item.title,
        item.subtitle,
        item.city,
        item.state,
        String(item.payload?.category ?? ""),
        String(item.payload?.postType ?? ""),
        String(item.payload?.eventType ?? ""),
        String(item.payload?.body ?? "")
      ]
        .join(" ")
        .toLowerCase()
        .replaceAll("_", " ");

      return topic
        .split(/\s+/)
        .filter(Boolean)
        .some((token) => searchable.includes(token));
    })
    .slice(0, 12);
}
