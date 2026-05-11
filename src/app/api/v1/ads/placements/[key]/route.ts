import { NextResponse } from "next/server";
import { getAdPlacementForContext } from "@/lib/ads/ads";

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    const { searchParams } = new URL(request.url);
    const visitorKey = searchParams.get("visitorKey") ?? undefined;
    const sessionKey = searchParams.get("sessionKey") ?? undefined;

    return NextResponse.json({
      data: await getAdPlacementForContext(key, {
        visitorKey,
        sessionKey
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
