import { NextResponse } from "next/server";
import { expireProviderVerificationAttempts } from "@/lib/claims/provider-verification";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { processWebhookDeliveries } from "@/lib/openapi/platform";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const [verificationExpiry, webhookDelivery] = await Promise.all([
      expireProviderVerificationAttempts({
        actorId: "cron:operations",
        limit: 50
      }),
      processWebhookDeliveries({
        limit: 25
      })
    ]);

    return NextResponse.json({
      data: {
        ranAt: new Date().toISOString(),
        verificationExpiry,
        webhookDelivery
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
