import { NextResponse } from "next/server";
import { browserApiNotice, isBrowserNavigation } from "@/lib/api/browser-guard";
import { previewCurrentSiteRealListings } from "@/lib/aggregation/public-source-acquisition";

export async function POST(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  try {
    const body = await request.json().catch(() => ({}));
    const maxRecords = Number(body.maxRecords ?? 50);

    return NextResponse.json({
      data: await previewCurrentSiteRealListings({
        maxRecords: Number.isFinite(maxRecords) ? maxRecords : 50,
        order: body.order === "asc" ? "asc" : "desc"
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
