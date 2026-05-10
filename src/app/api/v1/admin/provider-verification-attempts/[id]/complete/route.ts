import { NextResponse } from "next/server";
import { completeProviderVerificationAttempt } from "@/lib/claims/provider-verification";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.status || body.status === "pending") {
      return NextResponse.json({ error: "status must be passed, failed, or expired" }, { status: 422 });
    }

    return NextResponse.json({
      data: await completeProviderVerificationAttempt({
        attemptId: id,
        status: body.status,
        evidence: body.evidence,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

