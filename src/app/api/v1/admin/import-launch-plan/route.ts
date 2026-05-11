import { NextResponse } from "next/server";
import { getImportLaunchPlan } from "@/lib/aggregation/import-launch-plan";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      data: await getImportLaunchPlan({
        targetListings: Number(searchParams.get("targetListings") ?? 5000),
        batchSize: Number(searchParams.get("batchSize") ?? 500)
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      data: await getImportLaunchPlan({
        targetListings: body.targetListings,
        batchSize: body.batchSize,
        createQueuedBatches: body.createQueuedBatches === true
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
