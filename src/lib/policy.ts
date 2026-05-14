import crypto from "node:crypto";
import type {
  PolicyCheckRequest,
  PolicyCheckResult,
  PolicyDecision,
  ExpirePolicyOverrideResult,
  PolicyOverrideRequest,
  PolicyOverrideStatus,
  PolicyOverrideSummary,
  PolicyQueueItem,
  PolicyQueueSummary
} from "@/lib/domain/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const hardBlockPatterns = [
  "fake review",
  "undisclosed sponsored",
  "copy full article",
  "republish full article",
  "guaranteed medical outcome"
];

const legalReviewPatterns = ["medicaid", "medicare", "legal advice", "financial advice", "diagnosis"];

type PolicyCheckRecord = {
  id: string;
  subjectType: string;
  subjectId?: string;
  actionKey: string;
  inputPayload: Record<string, unknown>;
  decision: PolicyDecision;
  reasons: string[];
  checkedAt: string;
};

const localPolicyChecks: PolicyCheckRecord[] = [];
const localPolicyOverrides: PolicyOverrideRequest[] = [];

function mapPolicyCheck(row: Record<string, unknown>): PolicyCheckRecord {
  return {
    id: String(row.id),
    subjectType: String(row.subject_type),
    subjectId: row.subject_id ? String(row.subject_id) : undefined,
    actionKey: String(row.action_key),
    inputPayload:
      row.input_payload && typeof row.input_payload === "object" ? (row.input_payload as Record<string, unknown>) : {},
    decision: row.decision as PolicyDecision,
    reasons: Array.isArray(row.reasons) ? row.reasons.map(String) : [],
    checkedAt: String(row.checked_at ?? row.created_at ?? new Date().toISOString())
  };
}

function requiredDisclosuresForDecision(decision: PolicyDecision) {
  return decision === "approved_with_disclosure" ? ["Sponsored"] : [];
}

function severityForDecision(decision: PolicyDecision): PolicyQueueItem["severity"] {
  if (decision === "blocked_non_overridable") return "critical";
  if (decision === "blocked") return "high";
  if (decision === "needs_legal_review" || decision === "needs_expert_review") return "medium";
  return "low";
}

function inputPreview(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).slice(0, 8));
}

function nextActionsForDecision(record: PolicyCheckRecord) {
  if (record.decision === "blocked_non_overridable") {
    return ["Keep this action blocked and document the non-overridable policy reason before launch."];
  }

  if (record.decision === "blocked") {
    return ["Review the blocked action, capture admin notes, and only re-run after the input changes."];
  }

  if (record.decision === "needs_legal_review") {
    return ["Route to owner/legal review and record approval before publishing, sending, or importing."];
  }

  if (record.decision === "needs_expert_review" || record.decision === "needs_human_review") {
    return ["Route to a qualified admin reviewer and record the approval decision before execution."];
  }

  if (record.decision === "approved_with_disclosure") {
    return ["Confirm the required disclosure is visible in the UI, payload, or outbound message."];
  }

  return ["No policy action needed unless the source content changes."];
}

function toPolicyQueueItem(record: PolicyCheckRecord): PolicyQueueItem {
  return {
    id: record.id,
    subjectType: record.subjectType,
    subjectId: record.subjectId,
    actionKey: record.actionKey,
    decision: record.decision,
    severity: severityForDecision(record.decision),
    reasons: record.reasons,
    requiredDisclosures: requiredDisclosuresForDecision(record.decision),
    checkedAt: record.checkedAt,
    nextActions: nextActionsForDecision(record),
    inputPreview: inputPreview(record.inputPayload)
  };
}

function findLocalPolicyCheck(id: string) {
  return localPolicyChecks.find((check) => check.id === id);
}

function mapPolicyOverride(row: Record<string, unknown>, policyCheck?: PolicyQueueItem): PolicyOverrideRequest {
  return {
    id: String(row.id),
    policyCheckId: String(row.policy_check_id),
    status: row.status as PolicyOverrideStatus,
    reason: String(row.reason ?? ""),
    requestedBy: String(row.requested_by ?? "admin"),
    reviewedBy: row.reviewed_by ? String(row.reviewed_by) : undefined,
    reviewNotes: row.review_notes ? String(row.review_notes) : undefined,
    expiresAt: row.expires_at ? String(row.expires_at) : undefined,
    createdAt: String(row.created_at ?? new Date().toISOString()),
    reviewedAt: row.reviewed_at ? String(row.reviewed_at) : undefined,
    policyCheck
  };
}

export async function runPolicyCheck(request: PolicyCheckRequest): Promise<PolicyCheckResult> {
  const haystack = JSON.stringify(request.input).toLowerCase();
  const hardBlock = hardBlockPatterns.find((pattern) => haystack.includes(pattern));

  const result: PolicyCheckResult = hardBlock
    ? {
        decision: "blocked_non_overridable",
        reasons: [`Blocked by non-overridable policy: ${hardBlock}`],
        requiredDisclosures: [],
        nonOverridable: true
      }
    : legalReviewPatterns.some((pattern) => haystack.includes(pattern))
      ? {
          decision: "needs_legal_review",
          reasons: ["Sensitive health, legal, financial, Medicare, or Medicaid content requires review."],
          requiredDisclosures: ["Not medical, legal, or financial advice."],
          nonOverridable: false
        }
      : request.actionKey.includes("sponsored") || haystack.includes("sponsored")
        ? {
            decision: "approved_with_disclosure",
            reasons: ["Commercial placement requires visible disclosure."],
            requiredDisclosures: ["Sponsored"],
            nonOverridable: false
          }
        : {
            decision: "approved",
            reasons: ["No blocking policy signals detected."],
            requiredDisclosures: [],
            nonOverridable: false
          };

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("policy_checks")
      .insert({
        subject_type: request.subjectType,
        subject_id: request.subjectId,
        action_key: request.actionKey,
        input_payload: request.input,
        decision: result.decision,
        reasons: result.reasons
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Policy check persistence failed: ${error.message}`);
    }

    result.id = String(data.id);
  } else {
    const record: PolicyCheckRecord = {
      id: `policy-check-${crypto.randomUUID()}`,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      actionKey: request.actionKey,
      inputPayload: request.input,
      decision: result.decision,
      reasons: result.reasons,
      checkedAt: new Date().toISOString()
    };

    localPolicyChecks.unshift(record);
    result.id = record.id;
  }

  return result;
}

export async function getPolicyQueue(input: { decision?: PolicyDecision; limit?: number } = {}): Promise<PolicyQueueSummary> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 100), 250));
  const supabase = getSupabaseAdminClient();
  let source: PolicyQueueSummary["source"] = "local_fallback";
  let checks: PolicyCheckRecord[];

  if (supabase) {
    source = "supabase";
    let query = supabase.from("policy_checks").select("*").order("checked_at", { ascending: false }).limit(limit);

    if (input.decision) {
      query = query.eq("decision", input.decision);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Policy queue query failed: ${error.message}`);
    }

    checks = (data ?? []).map(mapPolicyCheck);
  } else {
    checks = localPolicyChecks.filter((check) => !input.decision || check.decision === input.decision).slice(0, limit);
  }

  const items = checks.map(toPolicyQueueItem);
  const reviewRequired = items.filter((item) =>
    ["needs_human_review", "needs_legal_review", "needs_expert_review"].includes(item.decision)
  );
  const blocked = items.filter((item) => item.decision === "blocked" || item.decision === "blocked_non_overridable");
  const disclosureRequired = items.filter((item) => item.decision === "approved_with_disclosure");
  const approved = items.filter((item) => item.decision === "approved");

  const nextActions = [
    ...(blocked.length ? ["Resolve or document blocked policy checks before launch actions continue."] : []),
    ...(reviewRequired.length ? ["Complete human/legal/expert review for queued policy checks."] : []),
    ...(disclosureRequired.length ? ["Verify required disclosures are visible anywhere approved-with-disclosure content appears."] : []),
    ...(!blocked.length && !reviewRequired.length && !disclosureRequired.length
      ? ["Policy queue has no active review blockers in the current result window."]
      : [])
  ];

  return {
    generatedAt: new Date().toISOString(),
    source,
    totals: {
      checks: items.length,
      approved: approved.length,
      disclosureRequired: disclosureRequired.length,
      humanReview: items.filter((item) => item.decision === "needs_human_review").length,
      legalReview: items.filter((item) => item.decision === "needs_legal_review").length,
      expertReview: items.filter((item) => item.decision === "needs_expert_review").length,
      blocked: items.filter((item) => item.decision === "blocked").length,
      nonOverridable: items.filter((item) => item.decision === "blocked_non_overridable").length
    },
    queues: {
      reviewRequired,
      blocked,
      disclosureRequired,
      approved
    },
    nextActions
  };
}

export async function createPolicyOverrideRequest(input: {
  policyCheckId: string;
  reason: string;
  requestedBy?: string;
  expiresAt?: string;
}): Promise<PolicyOverrideRequest> {
  const reason = input.reason.trim();

  if (!reason) {
    throw new Error("Override reason is required");
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const policyCheck = findLocalPolicyCheck(input.policyCheckId);

    if (!policyCheck) {
      throw new Error("Policy check not found");
    }

    if (policyCheck.decision === "approved") {
      throw new Error("Approved checks do not require an override request");
    }

    if (policyCheck.decision === "blocked_non_overridable") {
      throw new Error("Non-overridable policy checks cannot be overridden");
    }

    const request: PolicyOverrideRequest = {
      id: `policy-override-${crypto.randomUUID()}`,
      policyCheckId: input.policyCheckId,
      status: "requested",
      reason,
      requestedBy: input.requestedBy ?? "admin",
      expiresAt: input.expiresAt,
      createdAt: new Date().toISOString(),
      policyCheck: toPolicyQueueItem(policyCheck)
    };

    localPolicyOverrides.unshift(request);
    return request;
  }

  const { data: check, error: checkError } = await supabase
    .from("policy_checks")
    .select("*")
    .eq("id", input.policyCheckId)
    .single();

  if (checkError || !check) {
    throw new Error(`Policy check lookup failed: ${checkError?.message ?? "not found"}`);
  }

  const mappedCheck = mapPolicyCheck(check);

  if (mappedCheck.decision === "approved") {
    throw new Error("Approved checks do not require an override request");
  }

  if (mappedCheck.decision === "blocked_non_overridable") {
    throw new Error("Non-overridable policy checks cannot be overridden");
  }

  const { data, error } = await supabase
    .from("policy_approval_requests")
    .insert({
      policy_check_id: input.policyCheckId,
      status: "requested",
      reason,
      requested_by: input.requestedBy ?? "admin",
      expires_at: input.expiresAt
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Policy override request creation failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_type: "admin",
    event_type: "policy.override_requested",
    subject_type: "policy_check",
    subject_id: input.policyCheckId,
    payload: { reason, requestedBy: input.requestedBy ?? "admin" }
  });

  return mapPolicyOverride(data, toPolicyQueueItem(mappedCheck));
}

export async function listPolicyOverrideRequests(
  input: { status?: PolicyOverrideStatus; limit?: number } = {}
): Promise<PolicyOverrideSummary> {
  const limit = Math.max(1, Math.min(Number(input.limit ?? 100), 250));
  const supabase = getSupabaseAdminClient();
  let source: PolicyOverrideSummary["source"] = "local_fallback";
  let requests: PolicyOverrideRequest[];

  if (supabase) {
    source = "supabase";
    let query = supabase
      .from("policy_approval_requests")
      .select("*, policy_checks(*)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (input.status) {
      query = query.eq("status", input.status);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Policy override request query failed: ${error.message}`);
    }

    requests = (data ?? []).map((row) => {
      const check = row.policy_checks && typeof row.policy_checks === "object" ? toPolicyQueueItem(mapPolicyCheck(row.policy_checks)) : undefined;
      return mapPolicyOverride(row, check);
    });
  } else {
    requests = localPolicyOverrides
      .filter((request) => !input.status || request.status === input.status)
      .slice(0, limit);
  }

  const nextActions = [
    ...(requests.some((request) => request.status === "requested")
      ? ["Review requested policy overrides and approve or reject them before execution continues."]
      : []),
    ...(requests.some((request) => request.status === "approved")
      ? ["Ensure approved overrides are time-bound and visible in downstream audit history."]
      : []),
    ...(!requests.length ? ["No policy override requests exist in the current result window."] : [])
  ];

  return {
    generatedAt: new Date().toISOString(),
    source,
    totals: {
      requests: requests.length,
      requested: requests.filter((request) => request.status === "requested").length,
      approved: requests.filter((request) => request.status === "approved").length,
      rejected: requests.filter((request) => request.status === "rejected").length,
      expired: requests.filter((request) => request.status === "expired").length
    },
    requests,
    nextActions
  };
}

export async function decidePolicyOverrideRequest(input: {
  id: string;
  decision: "approved" | "rejected";
  reviewedBy?: string;
  reviewNotes?: string;
}): Promise<PolicyOverrideRequest> {
  const supabase = getSupabaseAdminClient();
  const reviewedAt = new Date().toISOString();

  if (!supabase) {
    const request = localPolicyOverrides.find((item) => item.id === input.id);

    if (!request) {
      throw new Error("Policy override request not found");
    }

    if (request.status !== "requested") {
      throw new Error("Only requested policy overrides can be decided");
    }

    request.status = input.decision;
    request.reviewedBy = input.reviewedBy ?? "admin";
    request.reviewNotes = input.reviewNotes;
    request.reviewedAt = reviewedAt;
    return request;
  }

  const { data: existing, error: lookupError } = await supabase
    .from("policy_approval_requests")
    .select("*")
    .eq("id", input.id)
    .single();

  if (lookupError || !existing) {
    throw new Error(`Policy override lookup failed: ${lookupError?.message ?? "not found"}`);
  }

  if (existing.status !== "requested") {
    throw new Error("Only requested policy overrides can be decided");
  }

  const { data, error } = await supabase
    .from("policy_approval_requests")
    .update({
      status: input.decision,
      reviewed_by: input.reviewedBy ?? "admin",
      review_notes: input.reviewNotes,
      reviewed_at: reviewedAt
    })
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Policy override decision failed: ${error.message}`);
  }

  if (input.decision === "approved") {
    const { error: overrideError } = await supabase.from("policy_overrides").insert({
      approval_request_id: input.id,
      policy_check_id: existing.policy_check_id,
      reason: existing.reason,
      approved_by: input.reviewedBy ?? "admin",
      expires_at: existing.expires_at
    });

    if (overrideError) {
      throw new Error(`Policy override audit creation failed: ${overrideError.message}`);
    }
  }

  await supabase.from("audit_events").insert({
    actor_type: "admin",
    event_type: `policy.override_${input.decision}`,
    subject_type: "policy_approval_request",
    subject_id: input.id,
    payload: { reviewedBy: input.reviewedBy ?? "admin", reviewNotes: input.reviewNotes }
  });

  return mapPolicyOverride(data);
}

export async function expirePolicyOverrideRequests(input: { now?: string; limit?: number } = {}): Promise<ExpirePolicyOverrideResult> {
  const now = input.now ?? new Date().toISOString();
  const limit = Math.max(1, Math.min(Number(input.limit ?? 100), 250));
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const candidates = localPolicyOverrides
      .filter((request) => (request.status === "requested" || request.status === "approved") && request.expiresAt)
      .filter((request) => Date.parse(request.expiresAt as string) <= Date.parse(now))
      .slice(0, limit);

    for (const request of candidates) {
      request.status = "expired";
      request.reviewedAt = request.reviewedAt ?? now;
      request.reviewNotes = request.reviewNotes ?? "Expired automatically by policy override expiry worker.";
    }

    return {
      generatedAt: new Date().toISOString(),
      source: "local_fallback",
      expired: candidates.length,
      expiredRequestIds: candidates.map((request) => request.id),
      nextActions: candidates.length
        ? ["Review expired policy overrides before re-running any previously approved launch action."]
        : ["No policy override requests were eligible for expiry."]
    };
  }

  const { data: candidates, error: candidateError } = await supabase
    .from("policy_approval_requests")
    .select("id")
    .in("status", ["requested", "approved"])
    .not("expires_at", "is", null)
    .lte("expires_at", now)
    .limit(limit);

  if (candidateError) {
    throw new Error(`Policy override expiry lookup failed: ${candidateError.message}`);
  }

  const ids = (candidates ?? []).map((row) => String(row.id));

  if (!ids.length) {
    return {
      generatedAt: new Date().toISOString(),
      source: "supabase",
      expired: 0,
      expiredRequestIds: [],
      nextActions: ["No policy override requests were eligible for expiry."]
    };
  }

  const { error } = await supabase
    .from("policy_approval_requests")
    .update({
      status: "expired",
      review_notes: "Expired automatically by policy override expiry worker.",
      reviewed_at: now
    })
    .in("id", ids);

  if (error) {
    throw new Error(`Policy override expiry update failed: ${error.message}`);
  }

  await supabase.from("audit_events").insert({
    actor_type: "system",
    event_type: "policy.overrides_expired",
    subject_type: "policy_approval_request",
    payload: { expiredRequestIds: ids, expired: ids.length, now }
  });

  return {
    generatedAt: new Date().toISOString(),
    source: "supabase",
    expired: ids.length,
    expiredRequestIds: ids,
    nextActions: ["Review expired policy overrides before re-running any previously approved launch action."]
  };
}
