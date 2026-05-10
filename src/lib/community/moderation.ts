import type {
  CommunityCommentRecord,
  CommunityPostRecord,
  CommunityReportRecord,
  CreateCommunityCommentInput,
  CreateCommunityPostInput,
  CreateCommunityReportInput,
  ModerateCommunityInput
} from "@/lib/domain/community";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedComments: CommunityCommentRecord[] = [];
const seedReports: CommunityReportRecord[] = [];

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

function mapCommunityComment(row: Record<string, unknown>): CommunityCommentRecord {
  return {
    id: String(row.id),
    postId: String(row.post_id),
    authorName: row.author_name ? String(row.author_name) : undefined,
    body: String(row.body),
    status: row.status as CommunityCommentRecord["status"],
    policyCheckId: row.policy_check_id ? String(row.policy_check_id) : undefined,
    createdAt: String(row.created_at)
  };
}

function mapCommunityReport(row: Record<string, unknown>): CommunityReportRecord {
  return {
    id: String(row.id),
    subjectType: String(row.subject_type),
    subjectId: String(row.subject_id),
    reporterEmail: row.reporter_email ? String(row.reporter_email) : undefined,
    reason: String(row.reason),
    details: row.details ? String(row.details) : undefined,
    status: row.status as CommunityReportRecord["status"],
    createdAt: String(row.created_at)
  };
}

export async function createCommunityPost(input: CreateCommunityPostInput): Promise<CommunityPostRecord> {
  const policy = await runPolicyCheck({
    subjectType: "community_post",
    actionKey: input.isSponsored ? "create_sponsored_community_post" : "create_community_post",
    input
  });

  const status = policy.decision.startsWith("blocked")
    ? "blocked_by_policy"
    : policy.decision === "approved"
      ? "published"
      : "pending_moderation";
  const disclosureLabel = input.isSponsored ? input.disclosureLabel ?? "Sponsored" : undefined;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-community-post-${Date.now()}`,
      communityId: input.communityId,
      providerId: input.providerId,
      authorName: input.authorName,
      postType: input.postType ?? "question",
      status,
      title: input.title,
      body: input.body,
      city: input.city,
      state: input.state,
      isSponsored: input.isSponsored ?? false,
      disclosureLabel,
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      community_id: input.communityId,
      provider_id: input.providerId,
      author_name: input.authorName,
      post_type: input.postType ?? "question",
      status,
      title: input.title,
      body: input.body,
      city: input.city,
      state: input.state,
      is_sponsored: input.isSponsored ?? false,
      disclosure_label: disclosureLabel
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community post creation failed: ${error.message}`);
  }

  return mapCommunityPost(data);
}

export async function listCommunityComments(postId: string): Promise<CommunityCommentRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedComments.filter((comment) => comment.postId === postId);
  }

  const { data, error } = await supabase
    .from("community_comments")
    .select("*")
    .eq("post_id", postId)
    .eq("status", "published")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Community comment query failed: ${error.message}`);
  }

  return (data ?? []).map(mapCommunityComment);
}

export async function createCommunityComment(input: CreateCommunityCommentInput): Promise<CommunityCommentRecord> {
  const policy = await runPolicyCheck({
    subjectType: "community_comment",
    subjectId: input.postId,
    actionKey: "create_community_comment",
    input
  });

  const status = policy.decision.startsWith("blocked")
    ? "blocked_by_policy"
    : policy.decision === "approved"
      ? "published"
      : "pending_moderation";
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-community-comment-${Date.now()}`,
      postId: input.postId,
      authorName: input.authorName,
      body: input.body,
      status,
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("community_comments")
    .insert({
      post_id: input.postId,
      author_name: input.authorName,
      body: input.body,
      status
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community comment creation failed: ${error.message}`);
  }

  return mapCommunityComment(data);
}

export async function createCommunityReport(input: CreateCommunityReportInput): Promise<CommunityReportRecord> {
  const policy = await runPolicyCheck({
    subjectType: "community_report",
    subjectId: input.subjectId,
    actionKey: "create_community_report",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Community report blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: `pending-community-report-${Date.now()}`,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      reporterEmail: input.reporterEmail,
      reason: input.reason,
      details: input.details,
      status: "open",
      createdAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("community_reports")
    .insert({
      subject_type: input.subjectType,
      subject_id: input.subjectId,
      reporter_email: input.reporterEmail,
      reason: input.reason,
      details: input.details
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community report creation failed: ${error.message}`);
  }

  return mapCommunityReport(data);
}

export async function moderateCommunitySubject(input: ModerateCommunityInput) {
  const policy = await runPolicyCheck({
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    actionKey: "moderate_community_subject",
    input
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "Community moderation blocked by policy");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return {
      id: input.subjectId,
      subjectType: input.subjectType,
      status: input.status,
      reason: input.reason,
      moderatedAt: new Date().toISOString()
    };
  }

  const table = input.subjectType === "community_post" ? "community_posts" : "community_comments";
  const { data, error } = await supabase.from(table).update({ status: input.status }).eq("id", input.subjectId).select("*").single();

  if (error) {
    throw new Error(`Community moderation failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: `${input.subjectType}.moderated`,
    subject_type: input.subjectType,
    subject_id: input.subjectId,
    payload: {
      status: input.status,
      reason: input.reason,
      policyDecision: policy.decision
    }
  });

  return input.subjectType === "community_post" ? mapCommunityPost(data) : mapCommunityComment(data);
}

