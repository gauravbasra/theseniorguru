import { NextResponse } from "next/server";
import { recordExtractedEntityEscalationDeliveryCallback } from "@/lib/aggregation/extracted-entities";

const DELIVERY_STATUSES = new Set(["accepted", "delivered", "failed", "retry_scheduled"]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.deliveryProvider || !body.deliveryStatus) {
      return NextResponse.json({ error: "deliveryProvider and deliveryStatus are required" }, { status: 422 });
    }

    if (!DELIVERY_STATUSES.has(body.deliveryStatus)) {
      return NextResponse.json(
        { error: "deliveryStatus must be accepted, delivered, failed, or retry_scheduled" },
        { status: 422 }
      );
    }

    if (!body.providerMessageId && !body.callbackId) {
      return NextResponse.json({ error: "providerMessageId or callbackId is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await recordExtractedEntityEscalationDeliveryCallback({
        deliveryProvider: body.deliveryProvider,
        deliveryStatus: body.deliveryStatus,
        providerMessageId: typeof body.providerMessageId === "string" ? body.providerMessageId : undefined,
        callbackId: typeof body.callbackId === "string" ? body.callbackId : undefined,
        deliveredAt: typeof body.deliveredAt === "string" ? body.deliveredAt : undefined,
        failureReason: typeof body.failureReason === "string" ? body.failureReason : undefined,
        rawPayload: body.rawPayload && typeof body.rawPayload === "object" ? body.rawPayload : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
