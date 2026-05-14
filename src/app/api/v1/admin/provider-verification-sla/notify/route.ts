import { NextResponse } from "next/server";
import { notifyProviderVerificationSlaAlerts } from "@/lib/claims/verification-queue";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await notifyProviderVerificationSlaAlerts({
        dryRun: body.dryRun === undefined ? true : Boolean(body.dryRun),
        deliveryProvider: body.deliveryProvider,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
