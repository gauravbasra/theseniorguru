import { NextResponse } from "next/server";
import { runExtractedEntityQualityAudit } from "@/lib/aggregation/extracted-entities";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await runExtractedEntityQualityAudit({
        status: body.status,
        limit: body.limit,
        minImages: body.minImages,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
