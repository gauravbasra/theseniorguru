import { NextResponse } from "next/server";
import type { PolicyDecision } from "@/lib/domain/providers";
import { getPolicyQueue } from "@/lib/policy";

const allowedDecisions: PolicyDecision[] = [
  "approved",
  "approved_with_disclosure",
  "needs_human_review",
  "needs_legal_review",
  "needs_expert_review",
  "blocked",
  "blocked_non_overridable"
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const decision = searchParams.get("decision");
    const limit = Number(searchParams.get("limit") ?? 100);

    if (decision && !allowedDecisions.includes(decision as PolicyDecision)) {
      return NextResponse.json({ error: "Unsupported policy decision filter" }, { status: 422 });
    }

    return NextResponse.json({
      data: await getPolicyQueue({
        decision: decision ? (decision as PolicyDecision) : undefined,
        limit: Number.isFinite(limit) ? limit : 100
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
