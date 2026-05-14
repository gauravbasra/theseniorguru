import { NextResponse } from "next/server";
import { getScheduledWorkerHealth } from "@/lib/scheduler/runs";

export async function GET() {
  try {
    return NextResponse.json({ data: await getScheduledWorkerHealth() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
