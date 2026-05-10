import { NextResponse } from "next/server";
import { recordAdClick } from "@/lib/ads/ads";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.placementKey) {
      return NextResponse.json({ error: "placementKey is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await recordAdClick({
        placementKey: body.placementKey,
        adCreativeId: body.adCreativeId,
        requestId: body.requestId,
        destinationUrl: body.destinationUrl,
        userContext: body.userContext
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

