import { NextResponse } from "next/server";
import { processWebhookDeliveries } from "@/lib/openapi/platform";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await processWebhookDeliveries({
        limit: body.limit,
        dryRun: body.dryRun !== false
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
