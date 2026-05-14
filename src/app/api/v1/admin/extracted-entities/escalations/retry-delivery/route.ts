import { NextResponse } from "next/server";
import { runExtractedEntityEscalationRetryDelivery } from "@/lib/aggregation/extracted-entities";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await runExtractedEntityEscalationRetryDelivery({
        dryRun: body.dryRun ?? true,
        limit: typeof body.limit === "number" ? body.limit : undefined,
        deliveryProvider:
          body.deliveryProvider === "manual_export" || body.deliveryProvider === "internal_notification_queue"
            ? body.deliveryProvider
            : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        reason: typeof body.reason === "string" ? body.reason : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
