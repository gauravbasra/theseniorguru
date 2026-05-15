import { NextResponse } from "next/server";
import {
  runExtractedEntityEscalationRetryDelivery,
  runExtractedEntityEscalationRetryScheduler
} from "@/lib/aggregation/extracted-entities";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getAppEnv } from "@/lib/env";
import type { ExtractedEntityEscalationDeliveryProvider } from "@/lib/domain/entities";
import { recordScheduledWorkerRun } from "@/lib/scheduler/runs";

export const dynamic = "force-dynamic";

function parseLimit(value?: string) {
  const parsed = Number(value ?? 25);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.floor(parsed), 100)) : 25;
}

function parseDeliveryProvider(value?: string): ExtractedEntityEscalationDeliveryProvider {
  return value === "internal_notification_queue" ? "internal_notification_queue" : "manual_export";
}

function getLiveApproval(env: ReturnType<typeof getAppEnv>) {
  const approved = env.importEscalationRetryCronLiveApproved === "true";
  const approvedBy = env.importEscalationRetryCronApprovedBy;
  const approvedAt = env.importEscalationRetryCronApprovedAt;
  const approvedAtValid = Boolean(approvedAt && !Number.isNaN(new Date(approvedAt).getTime()));
  const blockers = [
    ...(!approved ? ["Set IMPORT_ESCALATION_RETRY_CRON_LIVE_APPROVED=true after owner approval."] : []),
    ...(!approvedBy ? ["Set IMPORT_ESCALATION_RETRY_CRON_APPROVED_BY to the owner/admin who approved live import escalation retries."] : []),
    ...(!approvedAtValid ? ["Set IMPORT_ESCALATION_RETRY_CRON_APPROVED_AT to a valid ISO approval timestamp."] : [])
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
  const mode = env.importEscalationRetryCronMode === "live" ? "live" : "preview";
  const dryRun = mode !== "live";
  const limit = parseLimit(env.importEscalationRetryCronLimit);
  const deliveryProvider = parseDeliveryProvider(env.importEscalationRetryCronProvider);
  const liveApproval = getLiveApproval(env);

  try {
    if (mode === "live" && !liveApproval.canRunLive) {
      const run = await recordScheduledWorkerRun({
        workerKey: "cron:import-escalation-retry",
        status: "failed",
        startedAt,
        summary: {
          mode,
          dryRun: true,
          limit,
          deliveryProvider,
          blockedByLiveApproval: true,
          blockers: liveApproval.blockers,
          approvedBy: liveApproval.approvedBy,
          approvedAt: liveApproval.approvedAt
        },
        error: "Import escalation retry live cron is blocked until owner approval metadata is configured."
      });

      return NextResponse.json({
        data: {
          mode,
          ranAt: run.finishedAt,
          run,
          scheduler: null,
          delivery: null,
          liveApproval,
          blockers: liveApproval.blockers,
          nextActions: liveApproval.blockers
        }
      }, { status: 424 });
    }

    const scheduler = await runExtractedEntityEscalationRetryScheduler({
      dryRun,
      limit,
      deliveryProvider,
      actorId: "cron:import-escalation-retry",
      reason: dryRun ? "scheduled import escalation retry preview" : "scheduled import escalation retry"
    });
    const delivery = await runExtractedEntityEscalationRetryDelivery({
      dryRun,
      limit,
      deliveryProvider,
      actorId: "cron:import-escalation-retry",
      reason: dryRun ? "scheduled import escalation retry delivery preview" : "scheduled import escalation retry delivery"
    });
    const run = await recordScheduledWorkerRun({
      workerKey: "cron:import-escalation-retry",
      status: "succeeded",
      startedAt,
      summary: {
        mode,
        dryRun,
        deliveryProvider,
        liveApproval: mode === "live" ? liveApproval : undefined,
        schedulerCandidates: scheduler.candidates.length,
        retriesScheduled: scheduler.scheduled,
        deliveryBatches: delivery.batches.length,
        deliveryExecuted: delivery.executed,
        deliveryBlockers: delivery.blockers.length
      }
    });

    return NextResponse.json({
      data: {
        mode: dryRun ? "preview" : "live",
        ranAt: run.finishedAt,
        run,
        scheduler,
        delivery
      }
    });
  } catch (error) {
    await recordScheduledWorkerRun({
      workerKey: "cron:import-escalation-retry",
      status: "failed",
      startedAt,
      summary: { dryRun, limit, deliveryProvider },
      error: error instanceof Error ? error.message : "Unknown error"
    }).catch(() => undefined);

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
