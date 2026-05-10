import { NextResponse } from "next/server";
import { activateGrowthSubscription } from "@/lib/billing/growth-subscriptions";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await activateGrowthSubscription({
        subscriptionId: id,
        startsAt: body.startsAt,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

