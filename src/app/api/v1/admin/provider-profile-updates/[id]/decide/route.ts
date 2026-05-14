import { NextResponse } from "next/server";
import { decideProviderProfileUpdate } from "@/lib/providers/profile-updates";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    return NextResponse.json({
      data: await decideProviderProfileUpdate({
        auditId: id,
        decision: body.decision,
        reviewerId: body.reviewerId,
        reviewerNotes: body.reviewerNotes
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
