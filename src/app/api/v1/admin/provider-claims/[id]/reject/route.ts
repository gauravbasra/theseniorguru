import { NextResponse } from "next/server";
import { decideProviderClaim } from "@/lib/claims/provider-claims";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const decision = await decideProviderClaim({
      claimId: id,
      decision: "rejected",
      adminNotes: body.adminNotes,
      actorId: body.actorId
    });

    return NextResponse.json({ data: decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("already decided") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
