export type CommunityPostType =
  | "question"
  | "recommendation"
  | "event"
  | "provider_update"
  | "expert_answer"
  | "educational_tip"
  | "offer"
  | "safety_alert"
  | "support_request";

export type CommunityPostRecord = {
  id: string;
  communityId?: string;
  providerId?: string;
  authorName?: string;
  postType: CommunityPostType;
  status: "published" | "pending_moderation" | "hidden" | "removed" | "blocked_by_policy";
  title: string;
  body?: string;
  city?: string;
  state?: string;
  isSponsored: boolean;
  disclosureLabel?: string;
  createdAt: string;
};

export type AppFeedItem = {
  id: string;
  type: "provider" | "event" | "community_post";
  title: string;
  subtitle?: string;
  href?: string;
  city?: string;
  state?: string;
  sponsored: boolean;
  disclosureLabel?: string;
  payload: Record<string, unknown>;
};

