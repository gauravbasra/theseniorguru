import type {
  ExpertAnswerRankingInput,
  ExpertAnswerRankingResult,
  ExpertProfileRecord,
  SubmitExpertProfileInput,
  VerifyExpertProfileInput
} from "@/lib/domain/community";
import { recordAuditEvent } from "@/lib/audit-events";
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

function tokenize(value?: string) {
  return new Set(
    (value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 2)
  );
}

function overlapScore(left: Set<string>, right: Set<string>) {
  let score = 0;

  for (const token of left) {
    if (right.has(token)) score += 1;
  }

  return score;
}

function verificationFreshnessScore(expert: ExpertProfileRecord) {
  const timestamp = Date.parse(expert.verifiedAt ?? expert.createdAt);

  if (!Number.isFinite(timestamp)) return 0;

  const days = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  return Math.max(0, 10 - Math.floor(days / 90));
}

function scoreExpertForQuestion(expert: ExpertProfileRecord, input: ExpertAnswerRankingInput) {
  const reasons: string[] = [];
  let score = 20;

  if (input.city && expert.city?.toLowerCase() === input.city.toLowerCase()) {
    score += 25;
    reasons.push("same city");
  }

  if (input.state && expert.state?.toLowerCase() === input.state.toLowerCase()) {
    score += 15;
    reasons.push("same state");
  }

  const questionTokens = tokenize([input.question, input.topicKey].filter(Boolean).join(" "));
  const specialtyTokens = tokenize([expert.specialty, expert.title, expert.bio, expert.credentialSummary].filter(Boolean).join(" "));
  const matchedTokens = overlapScore(questionTokens, specialtyTokens);

  if (matchedTokens) {
    score += matchedTokens * 12;
    reasons.push(`${matchedTokens} specialty match${matchedTokens === 1 ? "" : "es"}`);
  }

  if (expert.credentialSummary) {
    score += 8;
    reasons.push("credential summary present");
  }

  if (expert.verifiedAt) {
    const freshness = verificationFreshnessScore(expert);
    score += freshness;
    reasons.push("verified expert");
  }

  return {
    score,
    reasons: reasons.length ? reasons : ["verified expert available"]
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

export async function rankExpertAnswers(input: ExpertAnswerRankingInput): Promise<ExpertAnswerRankingResult> {
  if (!input.question?.trim()) {
    throw new Error("question is required");
  }

  const limit = Math.max(1, Math.min(Number(input.limit ?? 5), 20));
  const policy = await runPolicyCheck({
    subjectType: "expert_answer_ranking",
    actionKey: "rank_expert_answers",
    input: {
      question: input.question,
      city: input.city,
      state: input.state,
      topicKey: input.topicKey,
      limit
    }
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Expert answer ranking blocked by policy");
  }

  const supabase = getSupabaseAdminClient();
  const experts = await listExpertProfiles({
    status: "verified",
    state: input.state
  });
  const rankings = experts
    .map((expert) => {
      const scored = scoreExpertForQuestion(expert, input);

      return {
        expert,
        score: scored.score,
        rank: 0,
        reasons: scored.reasons
      };
    })
    .sort((left, right) => right.score - left.score || left.expert.displayName.localeCompare(right.expert.displayName))
    .slice(0, limit)
    .map((ranking, index) => ({ ...ranking, rank: index + 1 }));

  const auditEvent = await recordAuditEvent({
    actorId: input.actorId,
    actorType: input.actorId ? "admin" : "system",
    eventType: "expert_answer.ranked",
    subjectType: "expert_answer_ranking",
    payload: {
      city: input.city,
      state: input.state,
      topicKey: input.topicKey,
      limit,
      rankedExpertIds: rankings.map((ranking) => ranking.expert.id),
      policyDecision: policy.decision
    }
  });

  if (supabase) {
    const { error } = await supabase.from("expert_answer_rankings").insert({
      question: input.question,
      city: input.city,
      state: input.state,
      topic_key: input.topicKey,
      ranking_payload: {
        rankings: rankings.map((ranking) => ({
          expertId: ranking.expert.id,
          score: ranking.score,
          rank: ranking.rank,
          reasons: ranking.reasons
        })),
        auditEventId: auditEvent.id,
        policyDecision: policy.decision
      }
    });

    if (error) {
      throw new Error(`Expert answer ranking persistence failed: ${error.message}`);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    source: supabase ? "supabase" : "local_fallback",
    query: {
      question: input.question,
      city: input.city,
      state: input.state,
      topicKey: input.topicKey
    },
    rankings,
    auditEventId: auditEvent.id,
    nextActions: rankings.length
      ? ["Route the question to the top verified expert or present ranked options for staff review."]
      : ["No verified experts matched this question. Invite or verify local experts before enabling automatic routing."]
  };
}
