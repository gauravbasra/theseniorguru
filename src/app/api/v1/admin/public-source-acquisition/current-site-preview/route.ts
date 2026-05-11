import { NextResponse } from "next/server";
import { browserApiNotice, isBrowserNavigation } from "@/lib/api/browser-guard";
import { previewCurrentSiteRealListings } from "@/lib/aggregation/public-source-acquisition";

function parseOrder(value: string | null) {
  return value === "asc" ? "asc" : "desc";
}

function parseMaxRecords(value: unknown, fallback: number) {
  const maxRecords = Number(value ?? fallback);
  return Number.isFinite(maxRecords) ? maxRecords : fallback;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    return NextResponse.json({
      data: await previewCurrentSiteRealListings({
        maxRecords: parseMaxRecords(url.searchParams.get("maxRecords"), 50),
        order: parseOrder(url.searchParams.get("order"))
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await previewCurrentSiteRealListings({
        maxRecords: parseMaxRecords(body.maxRecords, 50),
        order: parseOrder(body.order)
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
