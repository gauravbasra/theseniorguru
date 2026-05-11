import { NextResponse } from "next/server";
import { retryWebhookDeliveries } from "@/lib/openapi/platform";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (body.status && body.status !== "failed" && body.status !== "blocked") {
      return NextResponse.json({ error: "status must be failed or blocked" }, { status: 422 });
    }

    if (body.deliveryIds && !Array.isArray(body.deliveryIds)) {
      return NextResponse.json({ error: "deliveryIds must be an array" }, { status: 422 });
    }

    return NextResponse.json({
      data: await retryWebhookDeliveries({
        deliveryIds: body.deliveryIds,
        status: body.status,
        limit: body.limit,
        reason: body.reason,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
