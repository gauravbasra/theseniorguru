import { NextResponse } from "next/server";
import { reviewProviderClaimDocument } from "@/lib/claims/document-review";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.decision) {
      return NextResponse.json({ error: "decision is required" }, { status: 422 });
    }

    if (!body.evidence) {
      return NextResponse.json({ error: "evidence is required" }, { status: 422 });
    }

    const result = await reviewProviderClaimDocument({
      claimId: id,
      attemptId: body.attemptId,
      decision: body.decision,
      reviewerId: body.reviewerId ?? body.actorId,
      reviewerNotes: body.reviewerNotes,
      evidence: body.evidence
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Provider claim not found" || message === "Provider verification attempt not found"
        ? 404
        : message.includes("already decided") || message.includes("already completed") || message.includes("has expired")
          ? 409
          : message.includes("requires") || message.includes("must be")
            ? 422
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
