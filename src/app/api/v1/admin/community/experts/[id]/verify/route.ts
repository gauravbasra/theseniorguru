import { NextResponse } from "next/server";
import { verifyExpertProfile } from "@/lib/community/experts";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.decision) {
      return NextResponse.json({ error: "decision is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await verifyExpertProfile({
        expertProfileId: id,
        decision: body.decision,
        adminNotes: body.adminNotes,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
