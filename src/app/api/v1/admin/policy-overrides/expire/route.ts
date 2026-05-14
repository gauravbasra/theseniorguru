import { NextResponse } from "next/server";
import { expirePolicyOverrideRequests } from "@/lib/policy";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const limit = Number(body.limit ?? 100);

    return NextResponse.json({
      data: await expirePolicyOverrideRequests({
        now: body.now ? String(body.now) : undefined,
        limit: Number.isFinite(limit) ? limit : 100
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
