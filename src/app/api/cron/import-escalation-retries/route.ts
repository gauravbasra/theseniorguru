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

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const env = getAppEnv();
  const dryRun = env.importEscalationRetryCronMode !== "live";
  const limit = parseLimit(env.importEscalationRetryCronLimit);
  const deliveryProvider = parseDeliveryProvider(env.importEscalationRetryCronProvider);

  try {
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
        dryRun,
        deliveryProvider,
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
