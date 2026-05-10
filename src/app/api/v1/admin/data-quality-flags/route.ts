import { NextResponse } from "next/server";
import { listDataQualityFlags } from "@/lib/aggregation/crawl-jobs";

export async function GET() {
  try {
    return NextResponse.json({ data: await listDataQualityFlags() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
