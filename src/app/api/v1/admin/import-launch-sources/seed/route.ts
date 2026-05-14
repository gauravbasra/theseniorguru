import { NextResponse } from "next/server";
import { seedLaunchImportSources } from "@/lib/aggregation/launch-source-seeding";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const starterBatchSize = Number(body.starterBatchSize ?? 500);

    return NextResponse.json({
      data: await seedLaunchImportSources({
        createStarterBatches: body.createStarterBatches === true,
        starterBatchSize: Number.isFinite(starterBatchSize) ? starterBatchSize : 500,
        actorId: body.actorId ? String(body.actorId) : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
