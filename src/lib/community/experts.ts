import type {
  ExpertProfileRecord,
  SubmitExpertProfileInput,
  VerifyExpertProfileInput
} from "@/lib/domain/community";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedExperts: ExpertProfileRecord[] = [
  {
    id: "seed-expert-care-advisor-denver",
    userKey: "seed-expert-denver",
    displayName: "Denver Care Advisor",
    organization: "The Senior Guru Local Expert Network",
    title: "Senior care advisor",
    specialty: "Memory care tours and family decision support",
    city: "Denver",
    state: "CO",
    bio: "Verified local expert available for practical senior-care planning questions.",
    status: "verified",
    verifiedAt: "2026-05-10T00:00:00.000Z",
    createdAt: "2026-05-10T00:00:00.000Z"
  }
];

function mapExpert(row: Record<string, unknown>): ExpertProfileRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    displayName: String(row.display_name),
    email: row.email ? String(row.email) : undefined,
    organization: row.organization ? String(row.organization) : undefined,
    title: row.title ? String(row.title) : undefined,
    specialty: String(row.specialty),
    city: row.city ? String(row.city) : undefined,
    state: row.state ? String(row.state) : undefined,
    bio: row.bio ? String(row.bio) : undefined,
    websiteUrl: row.website_url ? String(row.website_url) : undefined,
    credentialSummary: row.credential_summary ? String(row.credential_summary) : undefined,
    status: row.status as ExpertProfileRecord["status"],
    verifiedAt: row.verified_at ? String(row.verified_at) : undefined,
    createdAt: String(row.created_at)
  };
}

export async function listExpertProfiles(filters: { status?: ExpertProfileRecord["status"]; city?: string; state?: string } = {}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedExperts
      .filter((expert) => (filters.status ? expert.status === filters.status : expert.status === "verified"))
      .filter((expert) => !filters.city || expert.city?.toLowerCase() === filters.city.toLowerCase())
      .filter((expert) => !filters.state || expert.state?.toLowerCase() === filters.state.toLowerCase());
  }

  let query = supabase.from("expert_profiles").select("*").order("created_at", { ascending: false }).limit(100);

  if (filters.status) query = query.eq("status", filters.status);
  else query = query.eq("status", "verified");
  if (filters.city) query = query.ilike("city", filters.city);
  if (filters.state) query = query.ilike("state", filters.state);

  const { data, error } = await query;

  if (error) {
    throw new Error(`Expert profile query failed: ${error.message}`);
  }

  return (data ?? []).map(mapExpert);
}

export async function submitExpertProfile(input: SubmitExpertProfileInput): Promise<ExpertProfileRecord> {
  const policy = await runPolicyCheck({
    subjectType: "expert_profile",
    actionKey: "submit_expert_profile",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Expert profile submission blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const expert: ExpertProfileRecord = {
      id: `expert-profile-${Date.now()}`,
      userKey: input.userKey,
      displayName: input.displayName,
      email: input.email,
      organization: input.organization,
      title: input.title,
      specialty: input.specialty,
      city: input.city,
      state: input.state,
      bio: input.bio,
      websiteUrl: input.websiteUrl,
      credentialSummary: input.credentialSummary,
      status: policy.decision === "approved" ? "pending_review" : "pending_review",
      createdAt: now
    };
    seedExperts.unshift(expert);
    return expert;
  }

  const { data, error } = await supabase
    .from("expert_profiles")
    .insert({
      user_key: input.userKey,
      display_name: input.displayName,
      email: input.email,
      organization: input.organization,
      title: input.title,
      specialty: input.specialty,
      city: input.city,
      state: input.state,
      bio: input.bio,
      website_url: input.websiteUrl,
      credential_summary: input.credentialSummary,
      evidence_urls: input.evidenceUrls ?? [],
      status: "pending_review"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Expert profile submission failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "user",
    event_type: "expert_profile.submitted",
    subject_type: "expert_profile",
    subject_id: data.id,
    payload: {
      policyDecision: policy.decision,
      specialty: input.specialty,
      evidenceUrls: input.evidenceUrls ?? []
    }
  });

  return mapExpert(data);
}

export async function verifyExpertProfile(input: VerifyExpertProfileInput): Promise<ExpertProfileRecord> {
  const policy = await runPolicyCheck({
    subjectType: "expert_profile",
    subjectId: input.expertProfileId,
    actionKey: "verify_expert_profile",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Expert profile verification blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const now = new Date().toISOString();

  if (!supabase) {
    const expert = seedExperts.find((item) => item.id === input.expertProfileId);

    if (!expert) {
      throw new Error("Expert profile not found");
    }

    Object.assign(expert, {
      status: input.decision,
      verifiedAt: input.decision === "verified" ? now : expert.verifiedAt
    });
    return expert;
  }

  const { data, error } = await supabase
    .from("expert_profiles")
    .update({
      status: input.decision,
      verified_at: input.decision === "verified" ? now : null,
      verification_payload: {
        adminNotes: input.adminNotes,
        policyDecision: policy.decision,
        decidedAt: now
      }
    })
    .eq("id", input.expertProfileId)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Expert profile verification failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_id: input.actorId,
    actor_type: input.actorId ? "admin" : "system",
    event_type: `expert_profile.${input.decision}`,
    subject_type: "expert_profile",
    subject_id: input.expertProfileId,
    payload: {
      adminNotes: input.adminNotes,
      policyDecision: policy.decision
    }
  });

  return mapExpert(data);
}
