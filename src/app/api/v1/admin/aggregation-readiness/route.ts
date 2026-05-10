import { NextResponse } from "next/server";
import { getAggregationLaunchReadiness } from "@/lib/aggregation/launch-readiness";

export async function GET() {
  try {
    return NextResponse.json({ data: await getAggregationLaunchReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
