import { NextResponse } from "next/server";
import { runVendorFeedWorker } from "@/lib/aggregation/vendor-feed-worker";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await runVendorFeedWorker({
        dryRun: body.dryRun !== false,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        maxFeeds: typeof body.maxFeeds === "number" ? body.maxFeeds : undefined,
        feeds: Array.isArray(body.feeds) ? body.feeds : []
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
