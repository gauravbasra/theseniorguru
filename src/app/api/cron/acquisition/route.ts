import { NextResponse } from "next/server";
import {
  previewCurrentSiteRealListings,
  runCurrentSiteRealListingAcquisition
} from "@/lib/aggregation/public-source-acquisition";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getAppEnv } from "@/lib/env";
import { recordScheduledWorkerRun } from "@/lib/scheduler/runs";

export const dynamic = "force-dynamic";

function parseMaxRecords(value?: string) {
  const parsed = Number(value ?? 100);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 250)) : 100;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();

  try {
    const env = getAppEnv();
    const mode = env.sourceAcquisitionCronMode === "live" ? "live" : "preview";
    const maxRecords = parseMaxRecords(env.sourceAcquisitionCronMaxRecords);

    if (mode === "live") {
      const run = await runCurrentSiteRealListingAcquisition({
        actorId: "cron:source-acquisition",
        dryRun: false,
        maxRecords,
        order: "desc"
      });
      const workerRun = await recordScheduledWorkerRun({
        workerKey: "cron:acquisition",
        status: "succeeded",
        startedAt,
        summary: {
          mode,
          discoveredListings: run.discoveredListings,
          totalRecords: run.totalRecords,
          stagedRecords: run.stagedRecords,
          skippedRecords: run.skippedRecords,
          rejectedRecords: run.rejectedRecords,
          errorRecords: run.errorRecords,
          productionGradeRecords: run.sourceCoverage.productionGradeRecords,
          qualityGapCount: run.qualityGaps.length
        }
      });

      return NextResponse.json({
        data: {
          mode,
          ranAt: workerRun.finishedAt,
          workerRun,
          run
        }
      });
    }

    const preview = await previewCurrentSiteRealListings({
      maxRecords,
      order: "desc"
    });
    const workerRun = await recordScheduledWorkerRun({
      workerKey: "cron:acquisition",
      status: "succeeded",
      startedAt,
      summary: {
        mode,
        discoveredListings: preview.discoveredListings,
        requestedRecords: preview.requestedRecords,
        parsedRecords: preview.parsedRecords,
        skippedRecords: preview.skippedRecords,
        productionGradeRecords: preview.sourceCoverage.productionGradeRecords,
        imageReadyRecords: preview.sourceCoverage.imageReadyRecords,
        imageBacklogRecords: preview.sourceCoverage.imageBacklogRecords,
        qualityGapCount: preview.qualityGaps.length
      }
    });

    return NextResponse.json({
      data: {
        mode,
        ranAt: workerRun.finishedAt,
        workerRun,
        preview: {
          discoveredListings: preview.discoveredListings,
          requestedRecords: preview.requestedRecords,
          parsedRecords: preview.parsedRecords,
          skippedRecords: preview.skippedRecords,
          sourceCoverage: preview.sourceCoverage,
          imageCoverage: preview.imageCoverage,
          qualityGapCount: preview.qualityGaps.length,
          sourcePolicies: preview.sourcePolicies
        }
      }
    });
  } catch (error) {
    await recordScheduledWorkerRun({
      workerKey: "cron:acquisition",
      status: "failed",
      startedAt,
      summary: {},
      error: error instanceof Error ? error.message : "Unknown error"
    }).catch(() => undefined);

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
