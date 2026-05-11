import { NextResponse } from "next/server";
import { submitProviderClaimEvidence } from "@/lib/claims/claim-evidence";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.evidence) {
      return NextResponse.json({ error: "evidence is required" }, { status: 422 });
    }

    const result = await submitProviderClaimEvidence({
      claimId: id,
      method: body.method,
      evidence: body.evidence,
      actorId: body.actorId
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Provider claim not found"
      ? 404
      : message.includes("must be true")
        ? 422
        : message.includes("already completed") || message.includes("has expired")
          ? 409
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
