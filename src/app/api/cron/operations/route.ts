import { NextResponse } from "next/server";
import { expireProviderVerificationAttempts } from "@/lib/claims/provider-verification";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { processWebhookDeliveries } from "@/lib/openapi/platform";
import { recordScheduledWorkerRun } from "@/lib/scheduler/runs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

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
    const run = await recordScheduledWorkerRun({
      workerKey: "cron:operations",
      status: "succeeded",
      startedAt,
      summary: {
        expiredVerificationAttempts: verificationExpiry.expired,
        webhookProcessed: webhookDelivery.processed,
        webhookDelivered: webhookDelivery.delivered,
        webhookFailed: webhookDelivery.failed,
        webhookBlocked: webhookDelivery.blocked
      }
    });

    return NextResponse.json({
      data: {
        ranAt: run.finishedAt,
        run,
        verificationExpiry,
        webhookDelivery
      }
    });
  } catch (error) {
    await recordScheduledWorkerRun({
      workerKey: "cron:operations",
      status: "failed",
      startedAt,
      summary: {},
      error: error instanceof Error ? error.message : "Unknown error"
    }).catch(() => undefined);

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
