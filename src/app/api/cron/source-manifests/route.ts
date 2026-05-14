import { NextResponse } from "next/server";
import { runSourceAdapterManifestFetchWorker } from "@/lib/aggregation/source-adapter-object-fetch";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getAppEnv } from "@/lib/env";
import { recordScheduledWorkerRun } from "@/lib/scheduler/runs";

export const dynamic = "force-dynamic";

function parseLimit(value?: string) {
  const parsed = Number(value ?? 10);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(Math.floor(parsed), 25)) : 10;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const env = getAppEnv();
  const dryRun = env.sourceManifestFetchCronMode !== "live";
  const maxManifests = parseLimit(env.sourceManifestFetchCronLimit);

  try {
    const worker = await runSourceAdapterManifestFetchWorker({
      dryRun,
      maxManifests,
      actorId: "cron:source-manifest-fetch"
    });
    const run = await recordScheduledWorkerRun({
      workerKey: "cron:source-manifest-fetch",
      status: "succeeded",
      startedAt,
      summary: {
        dryRun,
        manifestsReviewed: worker.manifestsReviewed,
        fetchReadyManifests: worker.fetchReadyManifests,
        executedManifests: worker.executedManifests,
        skippedManifests: worker.skippedManifests,
        blockedManifests: worker.blockedManifests,
        recordsFetched: worker.totals.recordsFetched,
        stagedRecords: worker.totals.stagedRecords,
        rejectedRecords: worker.totals.rejectedRecords,
        errorRecords: worker.totals.errorRecords
      }
    });

    return NextResponse.json({
      data: {
        mode: dryRun ? "preview" : "live",
        ranAt: run.finishedAt,
        run,
        worker
      }
    });
  } catch (error) {
    await recordScheduledWorkerRun({
      workerKey: "cron:source-manifest-fetch",
      status: "failed",
      startedAt,
      summary: { dryRun, maxManifests },
      error: error instanceof Error ? error.message : "Unknown error"
    }).catch(() => undefined);

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
