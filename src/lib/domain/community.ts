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

export type CommunityGroupRecord = {
  id: string;
  name: string;
  slug: string;
  city?: string;
  state?: string;
  description?: string;
  memberCount: number;
  createdAt: string;
};

export type CreateCommunityGroupInput = {
  name: string;
  slug?: string;
  city?: string;
  state?: string;
  description?: string;
  actorId?: string;
};

export type CommunityMembershipRecord = {
  id: string;
  communityId: string;
  userKey: string;
  displayName?: string;
  email?: string;
  role: "senior" | "family" | "caregiver" | "provider" | "expert" | "admin";
  status: "pending" | "active" | "blocked" | "removed";
  createdAt: string;
};

export type JoinCommunityGroupInput = {
  communityId: string;
  userKey: string;
  displayName?: string;
  email?: string;
  role?: CommunityMembershipRecord["role"];
  actorId?: string;
};

export type CommunityInvitationRecord = {
  id: string;
  communityId: string;
  inviterUserKey: string;
  recipientEmail: string;
  recipientName?: string;
  role: CommunityMembershipRecord["role"];
  status: "queued" | "sent" | "accepted" | "declined" | "blocked";
  deliveryChannel: "email" | "sms" | "manual";
  deliveryProvider?: "mailjet" | "google" | "manual" | "pending";
  deliveryId?: string;
  sentAt?: string;
  createdAt: string;
};

export type CreateCommunityInvitationInput = {
  communityId: string;
  inviterUserKey: string;
  recipientEmail: string;
  recipientName?: string;
  role?: CommunityMembershipRecord["role"];
  deliveryChannel?: CommunityInvitationRecord["deliveryChannel"];
  actorId?: string;
};

export type SendCommunityInvitationInput = {
  invitationId: string;
  deliveryChannel?: CommunityInvitationRecord["deliveryChannel"];
  deliveryProvider?: CommunityInvitationRecord["deliveryProvider"];
  deliveryId?: string;
  actorId?: string;
};

export type CommunityTopicSubscriptionRecord = {
  id: string;
  userKey: string;
  topicKey: string;
  topicLabel?: string;
  city?: string;
  state?: string;
  status: "active" | "paused" | "removed";
  createdAt: string;
  updatedAt?: string;
};

export type UpsertCommunityTopicSubscriptionInput = {
  userKey: string;
  topicKey: string;
  topicLabel?: string;
  city?: string;
  state?: string;
  status?: CommunityTopicSubscriptionRecord["status"];
  actorId?: string;
};

export type CommunityDigestDeliveryProvider = "manual_export" | "internal_notification_queue";

export type CommunityDigestDeliveryStatus = "preview" | "queued" | "skipped";

export type CommunityDigestDeliveryRecord = {
  id: string;
  userKey: string;
  topicKey?: string;
  city?: string;
  state?: string;
  deliveryProvider: CommunityDigestDeliveryProvider;
  deliveryStatus: CommunityDigestDeliveryStatus;
  feedItemCount: number;
  recipientDeviceCount: number;
  deliveryPayload: Record<string, unknown>;
  createdAt: string;
};

export type RunCommunityDigestInput = {
  city?: string;
  state?: string;
  topicKey?: string;
  userKey?: string;
  dryRun?: boolean;
  deliveryProvider?: CommunityDigestDeliveryProvider;
  actorId?: string;
};

export type CommunityDigestRunResult = {
  generatedAt: string;
  dryRun: boolean;
  deliveryProvider: CommunityDigestDeliveryProvider;
  source: "supabase" | "local_fallback";
  filters: {
    city?: string;
    state?: string;
    topicKey?: string;
    userKey?: string;
  };
  totals: {
    activeSubscriptions: number;
    recipientUsers: number;
    feedItems: number;
    queuedDeliveries: number;
    skippedDeliveries: number;
  };
  deliveries: CommunityDigestDeliveryRecord[];
  nextActions: string[];
};

export type ExpertProfileRecord = {
  id: string;
  userKey: string;
  displayName: string;
  email?: string;
  organization?: string;
  title?: string;
  specialty: string;
  city?: string;
  state?: string;
  bio?: string;
  websiteUrl?: string;
  credentialSummary?: string;
  status: "pending_review" | "verified" | "rejected" | "suspended";
  verifiedAt?: string;
  createdAt: string;
};

export type SubmitExpertProfileInput = {
  userKey: string;
  displayName: string;
  email?: string;
  organization?: string;
  title?: string;
  specialty: string;
  city?: string;
  state?: string;
  bio?: string;
  websiteUrl?: string;
  credentialSummary?: string;
  evidenceUrls?: string[];
  actorId?: string;
};

export type VerifyExpertProfileInput = {
  expertProfileId: string;
  decision: "verified" | "rejected" | "suspended";
  adminNotes?: string;
  actorId?: string;
};

export type ExpertAnswerRankingInput = {
  question: string;
  city?: string;
  state?: string;
  topicKey?: string;
  limit?: number;
  actorId?: string;
};

export type ExpertAnswerRankingRecord = {
  expert: ExpertProfileRecord;
  score: number;
  rank: number;
  reasons: string[];
};

export type ExpertAnswerRankingResult = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  query: {
    question: string;
    city?: string;
    state?: string;
    topicKey?: string;
  };
  rankings: ExpertAnswerRankingRecord[];
  auditEventId?: string;
  nextActions: string[];
};

export type LocalTrustScoreInput = {
  city?: string;
  state?: string;
  actorId?: string;
};

export type LocalTrustScoreResult = {
  generatedAt: string;
  source: "supabase" | "local_fallback";
  scope: {
    city?: string;
    state?: string;
  };
  score: number;
  rating: "strong" | "developing" | "needs_review";
  signals: {
    communityGroups: number;
    activeMembers: number;
    verifiedExperts: number;
    activeTopicSubscriptions: number;
    localFeedItems: number;
    moderationReports: number;
  };
  reasons: string[];
  auditEventId?: string;
  nextActions: string[];
};

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

export type CreateCommunityPostInput = {
  communityId?: string;
  providerId?: string;
  authorName?: string;
  postType?: CommunityPostType;
  title: string;
  body?: string;
  city?: string;
  state?: string;
  isSponsored?: boolean;
  disclosureLabel?: string;
};

export type CommunityCommentRecord = {
  id: string;
  postId: string;
  authorName?: string;
  body: string;
  status: CommunityPostRecord["status"];
  policyCheckId?: string;
  createdAt: string;
};

export type CreateCommunityCommentInput = {
  postId: string;
  authorName?: string;
  body: string;
};

export type CommunityReportRecord = {
  id: string;
  subjectType: string;
  subjectId: string;
  reporterEmail?: string;
  reason: string;
  details?: string;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
};

export type CreateCommunityReportInput = {
  subjectType: "community_post" | "community_comment" | "provider" | "event";
  subjectId: string;
  reporterEmail?: string;
  reason: string;
  details?: string;
};

export type ModerateCommunityInput = {
  subjectType: "community_post" | "community_comment";
  subjectId: string;
  status: CommunityPostRecord["status"];
  actorId?: string;
  reason?: string;
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
