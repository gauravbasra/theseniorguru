import { NextResponse } from "next/server";
import { expireProviderVerificationAttempts } from "@/lib/claims/provider-verification";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await expireProviderVerificationAttempts({
        claimId: typeof body.claimId === "string" ? body.claimId : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : undefined,
        dryRun: body.dryRun !== false
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
