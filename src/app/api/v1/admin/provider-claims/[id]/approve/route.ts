import { NextResponse } from "next/server";
import { decideProviderClaim } from "@/lib/claims/provider-claims";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const decision = await decideProviderClaim({
      claimId: id,
      decision: "approved",
      adminNotes: body.adminNotes,
      actorId: body.actorId
    });

    return NextResponse.json({ data: decision });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

