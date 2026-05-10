import type { PolicyCheckRequest, PolicyCheckResult } from "@/lib/domain/providers";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const hardBlockPatterns = [
  "fake review",
  "undisclosed sponsored",
  "copy full article",
  "republish full article",
  "guaranteed medical outcome"
];

const legalReviewPatterns = ["medicaid", "medicare", "legal advice", "financial advice", "diagnosis"];

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
  }

  return result;
}

