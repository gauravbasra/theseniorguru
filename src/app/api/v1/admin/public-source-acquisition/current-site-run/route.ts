import { NextResponse } from "next/server";
import { isBrowserNavigation, browserApiNotice } from "@/lib/api/browser-guard";
import { runCurrentSiteRealListingAcquisition } from "@/lib/aggregation/public-source-acquisition";

export async function POST(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxRecords = Number(body.maxRecords ?? 18);
    const data = await runCurrentSiteRealListingAcquisition({
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      dryRun: body.dryRun !== false,
      maxRecords: Number.isFinite(maxRecords) ? maxRecords : 18,
      order: body.order === "asc" ? "asc" : "desc"
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
