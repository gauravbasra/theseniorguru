import { NextResponse } from "next/server";
import { runWebhookRetryScheduler } from "@/lib/openapi/platform";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await runWebhookRetryScheduler({
        retryLimit: body.retryLimit,
        deliveryLimit: body.deliveryLimit,
        includeBlocked: body.includeBlocked,
        dryRun: body.dryRun ?? true,
        actorId: body.actorId,
        reason: body.reason
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
