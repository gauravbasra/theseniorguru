import { NextResponse } from "next/server";
import { runCommunityDigestDelivery } from "@/lib/community/groups";

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
      data: await runCommunityDigestDelivery({
        city: typeof body.city === "string" ? body.city : undefined,
        state: typeof body.state === "string" ? body.state : undefined,
        topicKey: typeof body.topicKey === "string" ? body.topicKey : undefined,
        userKey: typeof body.userKey === "string" ? body.userKey : undefined,
        dryRun: body.dryRun !== false,
        deliveryProvider: body.deliveryProvider,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
