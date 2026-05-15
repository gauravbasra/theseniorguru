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

function getLiveApproval(env: ReturnType<typeof getAppEnv>) {
  const approved = env.sourceManifestFetchCronLiveApproved === "true";
  const approvedBy = env.sourceManifestFetchCronApprovedBy;
  const approvedAt = env.sourceManifestFetchCronApprovedAt;
  const approvedAtValid = Boolean(approvedAt && !Number.isNaN(new Date(approvedAt).getTime()));
  const blockers = [
    ...(!approved ? ["Set SOURCE_MANIFEST_FETCH_CRON_LIVE_APPROVED=true after owner approval."] : []),
    ...(!approvedBy ? ["Set SOURCE_MANIFEST_FETCH_CRON_APPROVED_BY to the owner/admin who approved live source-object fetches."] : []),
    ...(!approvedAtValid ? ["Set SOURCE_MANIFEST_FETCH_CRON_APPROVED_AT to a valid ISO approval timestamp."] : [])
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
  const mode = env.sourceManifestFetchCronMode === "live" ? "live" : "preview";
  const dryRun = mode !== "live";
  const maxManifests = parseLimit(env.sourceManifestFetchCronLimit);
  const liveApproval = getLiveApproval(env);

  try {
    if (mode === "live" && !liveApproval.canRunLive) {
      const run = await recordScheduledWorkerRun({
        workerKey: "cron:source-manifest-fetch",
        status: "failed",
        startedAt,
        summary: {
          mode,
          dryRun: true,
          maxManifests,
          blockedByLiveApproval: true,
          blockers: liveApproval.blockers,
          approvedBy: liveApproval.approvedBy,
          approvedAt: liveApproval.approvedAt
        },
        error: "Source manifest live fetch cron is blocked until owner approval metadata is configured."
      });

      return NextResponse.json({
        data: {
          mode,
          ranAt: run.finishedAt,
          run,
          worker: null,
          liveApproval,
          blockers: liveApproval.blockers,
          nextActions: liveApproval.blockers
        }
      }, { status: 424 });
    }

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
        mode,
        dryRun,
        liveApproval: mode === "live" ? liveApproval : undefined,
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
