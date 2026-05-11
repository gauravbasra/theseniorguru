import type {
  CommunityGroupRecord,
  CommunityMembershipRecord,
  CreateCommunityGroupInput,
  JoinCommunityGroupInput
} from "@/lib/domain/community";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedGroups: CommunityGroupRecord[] = [
  {
    id: "seed-denver-caregivers",
    name: "Denver Senior Care Circle",
    slug: "denver-senior-care-circle",
    city: "Denver",
    state: "CO",
    description: "A local community for families comparing assisted living, memory care, home care, and senior support services.",
    memberCount: 0,
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];
const seedMemberships: CommunityMembershipRecord[] = [];

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function mapGroup(row: Record<string, unknown>, memberCount = 0): CommunityGroupRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    description: row.description ? String(row.description) : undefined,
    memberCount,
    createdAt: String(row.created_at)
  };
}

function mapMembership(row: Record<string, unknown>): CommunityMembershipRecord {
  return {
    id: String(row.id),
    communityId: String(row.community_id),
    userKey: String(row.user_key),
    displayName: row.display_name ? String(row.display_name) : undefined,
    email: row.email ? String(row.email) : undefined,
    role: row.role as CommunityMembershipRecord["role"],
    status: row.status as CommunityMembershipRecord["status"],
    createdAt: String(row.created_at)
  };
}

export async function listCommunityGroups(filters: { city?: string; state?: string } = {}): Promise<CommunityGroupRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedGroups
      .filter((group) => !filters.city || group.city?.toLowerCase() === filters.city.toLowerCase())
      .filter((group) => !filters.state || group.state?.toLowerCase() === filters.state.toLowerCase())
      .map((group) => ({
        ...group,
        memberCount: seedMemberships.filter((membership) => membership.communityId === group.id && membership.status === "active").length
      }));
  }

  let query = supabase.from("communities").select("*").order("created_at", { ascending: false }).limit(100);

  if (filters.city) query = query.ilike("city", filters.city);
  if (filters.state) query = query.ilike("state", filters.state);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Community group query failed: ${error.message}`);
  }

  const counts = await Promise.all(
    (data ?? []).map(async (community) => {
      const { count } = await supabase
        .from("community_memberships")
        .select("*", { count: "exact", head: true })
        .eq("community_id", community.id)
        .eq("status", "active");
      return [String(community.id), count ?? 0] as const;
    })
  );
  const countMap = new Map(counts);

  return (data ?? []).map((row) => mapGroup(row, countMap.get(String(row.id)) ?? 0));
}

export async function createCommunityGroup(input: CreateCommunityGroupInput): Promise<CommunityGroupRecord> {
  const policy = await runPolicyCheck({
    subjectType: "community_group",
    actionKey: "create_community_group",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Community group creation blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const slug = input.slug ?? slugify([input.city, input.state, input.name].filter(Boolean).join(" "));

  if (!supabase) {
    const group: CommunityGroupRecord = {
      id: `community-group-${Date.now()}`,
      name: input.name,
      slug,
      city: input.city,
      state: input.state,
      description: input.description,
      memberCount: 0,
      createdAt: now
    };
    seedGroups.unshift(group);
    return group;
  }

  const { data, error } = await supabase
    .from("communities")
    .insert({
      name: input.name,
      slug,
      city: input.city,
      state: input.state,
      description: input.description
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community group creation failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "community_group.created",
    subject_type: "community_group",
    subject_id: data.id,
    payload: { policyDecision: policy.decision, slug }
  });

  return mapGroup(data);
}

export async function listCommunityGroupMembers(communityId: string): Promise<CommunityMembershipRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedMemberships.filter((membership) => membership.communityId === communityId);
  }

  const { data, error } = await supabase
    .from("community_memberships")
    .select("*")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(`Community membership query failed: ${error.message}`);
  }

  return (data ?? []).map(mapMembership);
}

export async function joinCommunityGroup(input: JoinCommunityGroupInput): Promise<CommunityMembershipRecord> {
  const policy = await runPolicyCheck({
    subjectType: "community_membership",
    subjectId: input.communityId,
    actionKey: "join_community_group",
    input
  });
  const status = policy.decision.startsWith("blocked")
    ? "blocked"
    : policy.decision === "approved"
      ? "active"
      : "pending";
  const role = input.role ?? "family";
  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const membership: CommunityMembershipRecord = {
      id: `community-membership-${Date.now()}`,
      communityId: input.communityId,
      userKey: input.userKey,
      displayName: input.displayName,
      email: input.email,
      role,
      status,
      createdAt: now
    };
    seedMemberships.unshift(membership);
    return membership;
  }

  const { data, error } = await supabase
    .from("community_memberships")
    .upsert({
      community_id: input.communityId,
      user_key: input.userKey,
      display_name: input.displayName,
      email: input.email,
      role,
      status
    }, { onConflict: "community_id,user_key" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Community membership upsert failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: "community_membership.upserted",
    subject_type: "community_group",
    subject_id: input.communityId,
    payload: {
      userKey: input.userKey,
      role,
      status,
      policyDecision: policy.decision
    }
  });

  return mapMembership(data);
}
