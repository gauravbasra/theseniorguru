import { NextResponse } from "next/server";
import { getLocalTrustScore } from "@/lib/community/trust-score";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    return NextResponse.json({
      data: await getLocalTrustScore({
        city: searchParams.get("city") ?? undefined,
        state: searchParams.get("state") ?? undefined,
        actorId: searchParams.get("actorId") ?? undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
