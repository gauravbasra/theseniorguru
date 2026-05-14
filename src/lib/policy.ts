import crypto from "node:crypto";
import type {
  PolicyCheckRequest,
  PolicyCheckResult,
  PolicyDecision,
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
    await supabase.from("policy_checks").insert({
      subject_type: request.subjectType,
      subject_id: request.subjectId,
      action_key: request.actionKey,
      input_payload: request.input,
      decision: result.decision,
      reasons: result.reasons
    });
  } else {
    localPolicyChecks.unshift({
      id: `policy-check-${crypto.randomUUID()}`,
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      actionKey: request.actionKey,
      inputPayload: request.input,
      decision: result.decision,
      reasons: result.reasons,
      checkedAt: new Date().toISOString()
    });
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
