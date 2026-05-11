import { NextResponse } from "next/server";
import { isBrowserNavigation, browserApiNotice } from "@/lib/api/browser-guard";
import { runPublicSourceSampleAcquisition } from "@/lib/aggregation/public-source-acquisition";

export async function POST(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const data = await runPublicSourceSampleAcquisition({
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      dryRun: Boolean(body.dryRun)
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
