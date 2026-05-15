import { NextResponse } from "next/server";
import { deliverQueuedEventAutomation } from "@/lib/events/event-automation";

const allowedProviders = new Set(["manual_export", "internal_notification_queue"]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.deliveryProvider && !allowedProviders.has(body.deliveryProvider)) {
      return NextResponse.json(
        { error: "deliveryProvider must be manual_export or internal_notification_queue" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      data: await deliverQueuedEventAutomation({
        eventId: typeof body.eventId === "string" ? body.eventId : undefined,
        dryRun: body.dryRun !== false,
        deliveryProvider: body.deliveryProvider,
        actorId: typeof body.actorId === "string" ? body.actorId : "admin:event-automation-delivery",
        limit: typeof body.limit === "number" ? body.limit : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
