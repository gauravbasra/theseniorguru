import { NextResponse } from "next/server";
import { listScheduledWorkerRuns } from "@/lib/scheduler/runs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Number(searchParams.get("limit") ?? 50);

    return NextResponse.json({
      data: await listScheduledWorkerRuns({
        workerKey: searchParams.get("workerKey") ?? undefined,
        status: status === "succeeded" || status === "failed" ? status : undefined,
        limit: Number.isFinite(limit) ? limit : 50
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
