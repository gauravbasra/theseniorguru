import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getAppEnv } from "@/lib/env";
import { runWebhookRetryScheduler } from "@/lib/openapi/platform";
import { recordScheduledWorkerRun } from "@/lib/scheduler/runs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const env = getAppEnv();
  const retryLimit = Number(env.webhookRetryCronLimit ?? 25);
  const dryRun = env.webhookRetryCronMode !== "live";

  try {
    const scheduler = await runWebhookRetryScheduler({
      retryLimit,
      deliveryLimit: retryLimit,
      dryRun,
      actorId: "cron:webhooks",
      reason: dryRun ? "scheduled webhook retry preview" : "scheduled webhook retry"
    });
    const run = await recordScheduledWorkerRun({
      workerKey: "cron:webhook-retry",
      status: "succeeded",
      startedAt,
      summary: {
        dryRun,
        failedCandidates: scheduler.failedCandidates,
        blockedCandidates: scheduler.blockedCandidates,
        failedRequeued: scheduler.failedRetry.requeued,
        blockedRequeued: scheduler.blockedRetry?.requeued ?? 0,
        webhookProcessed: scheduler.delivery.processed,
        webhookDelivered: scheduler.delivery.delivered,
        webhookFailed: scheduler.delivery.failed,
        webhookBlocked: scheduler.delivery.blocked
      }
    });

    return NextResponse.json({
      data: {
        ranAt: run.finishedAt,
        run,
        scheduler
      }
    });
  } catch (error) {
    await recordScheduledWorkerRun({
      workerKey: "cron:webhook-retry",
      status: "failed",
      startedAt,
      summary: { dryRun },
      error: error instanceof Error ? error.message : "Unknown error"
    }).catch(() => undefined);

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
