import { NextResponse } from "next/server";
import { runGoogleAdManagerSync } from "@/lib/ads/ads";

const allowedModes = new Set(["preview", "manual_export", "google_ad_manager"]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.mode && !allowedModes.has(body.mode)) {
      return NextResponse.json({ error: "mode must be preview, manual_export, or google_ad_manager" }, { status: 422 });
    }

    if (body.placementKeys && !Array.isArray(body.placementKeys)) {
      return NextResponse.json({ error: "placementKeys must be an array when provided" }, { status: 422 });
    }

    return NextResponse.json({
      data: await runGoogleAdManagerSync({
        mode: body.mode,
        placementKeys: body.placementKeys?.map(String),
        dryRun: body.dryRun !== false,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
