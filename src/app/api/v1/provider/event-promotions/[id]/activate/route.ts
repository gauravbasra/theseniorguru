import { NextResponse } from "next/server";
import { EventPromotionActivationError, activateEventPromotion } from "@/lib/events/event-promotions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await activateEventPromotion({
        promotionId: id,
        actorId: body.actorId,
        dryRun: body.dryRun === false ? false : true
      })
    });
  } catch (error) {
    const status = error instanceof EventPromotionActivationError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status });
  }
}
