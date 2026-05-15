import { NextResponse } from "next/server";
import {
  getLaunchImportExecutionStatus,
  runLaunchImportExecution
} from "@/lib/aggregation/import-launch-execution";

export async function GET() {
  try {
    return NextResponse.json({ data: await getLaunchImportExecutionStatus() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const maxRecords = Number(body.maxRecords ?? 25);
    const starterBatchSize = Number(body.starterBatchSize ?? 125);

    const data = await runLaunchImportExecution({
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        dryRun: body.dryRun !== false,
        ensureSources: body.ensureSources !== false,
        maxRecords: Number.isFinite(maxRecords) ? maxRecords : 25,
        starterBatchSize: Number.isFinite(starterBatchSize) ? starterBatchSize : 125
      });

    return NextResponse.json({ data }, { status: data.blockedByLiveApproval ? 424 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
