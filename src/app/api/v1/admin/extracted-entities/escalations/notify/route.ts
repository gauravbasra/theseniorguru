import { NextResponse } from "next/server";
import { notifyExtractedEntityReviewEscalations } from "@/lib/aggregation/extracted-entities";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await notifyExtractedEntityReviewEscalations({
        dryRun: body.dryRun !== false,
        limit: typeof body.limit === "number" ? body.limit : undefined,
        minImages: typeof body.minImages === "number" ? body.minImages : undefined,
        deliveryProvider: body.deliveryProvider,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
