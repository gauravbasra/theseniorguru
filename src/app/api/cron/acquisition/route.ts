import { NextResponse } from "next/server";
import {
  previewCurrentSiteRealListings,
  runCurrentSiteRealListingAcquisition
} from "@/lib/aggregation/public-source-acquisition";
import { isAuthorizedCronRequest } from "@/lib/cron/auth";
import { getAppEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

function parseMaxRecords(value?: string) {
  const parsed = Number(value ?? 100);
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 250)) : 100;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

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

      return NextResponse.json({
        data: {
          mode,
          ranAt: new Date().toISOString(),
          run
        }
      });
    }

    const preview = await previewCurrentSiteRealListings({
      maxRecords,
      order: "desc"
    });

    return NextResponse.json({
      data: {
        mode,
        ranAt: new Date().toISOString(),
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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
