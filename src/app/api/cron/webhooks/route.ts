import { NextResponse } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getAppEnv } from "@/lib/env";
import { runWebhookRetryScheduler } from "@/lib/openapi/platform";
import { recordScheduledWorkerRun } from "@/lib/scheduler/runs";

export const dynamic = "force-dynamic";

function getLiveApproval(env: ReturnType<typeof getAppEnv>) {
  const approved = env.webhookRetryCronLiveApproved === "true";
  const approvedBy = env.webhookRetryCronApprovedBy;
  const approvedAt = env.webhookRetryCronApprovedAt;
  const approvedAtValid = Boolean(approvedAt && !Number.isNaN(new Date(approvedAt).getTime()));
  const blockers = [
    ...(!approved ? ["Set WEBHOOK_RETRY_CRON_LIVE_APPROVED=true after owner approval."] : []),
    ...(!approvedBy ? ["Set WEBHOOK_RETRY_CRON_APPROVED_BY to the owner/admin who approved live webhook retries."] : []),
    ...(!approvedAtValid ? ["Set WEBHOOK_RETRY_CRON_APPROVED_AT to a valid ISO approval timestamp."] : [])
  ];

  return {
    approved,
    approvedBy,
    approvedAt,
    approvedAtValid,
    blockers,
    canRunLive: approved && Boolean(approvedBy) && approvedAtValid
  };
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const env = getAppEnv();
  const retryLimit = Number(env.webhookRetryCronLimit ?? 25);
  const mode = env.webhookRetryCronMode === "live" ? "live" : "preview";
  const dryRun = mode !== "live";
  const liveApproval = getLiveApproval(env);

  try {
    if (mode === "live" && !liveApproval.canRunLive) {
      const run = await recordScheduledWorkerRun({
        workerKey: "cron:webhook-retry",
        status: "failed",
        startedAt,
        summary: {
          mode,
          dryRun: true,
          retryLimit,
          blockedByLiveApproval: true,
          blockers: liveApproval.blockers,
          approvedBy: liveApproval.approvedBy,
          approvedAt: liveApproval.approvedAt
        },
        error: "Webhook retry live cron is blocked until owner approval metadata is configured."
      });

      return NextResponse.json({
        data: {
          mode,
          ranAt: run.finishedAt,
          run,
          scheduler: null,
          liveApproval,
          blockers: liveApproval.blockers,
          nextActions: liveApproval.blockers
        }
      }, { status: 424 });
    }

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
        mode,
        dryRun,
        liveApproval: mode === "live" ? liveApproval : undefined,
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
        mode,
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
