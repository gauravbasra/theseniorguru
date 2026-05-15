import { NextResponse } from "next/server";
import { getPostCutoverMonitor, recordPostCutoverMonitorRun, summarizeMonitorAudit } from "@/lib/system/post-cutover-monitor";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") !== "false";
    const data = await getPostCutoverMonitor(dryRun);

    return NextResponse.json({
      data: {
        ...data,
        latestAuditEvent: summarizeMonitorAudit(data.latestAuditEvent)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await recordPostCutoverMonitorRun({
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
      notes: typeof body.notes === "string" ? body.notes : undefined
    });

    return NextResponse.json({
      data: {
        ...data,
        latestAuditEvent: summarizeMonitorAudit(data.latestAuditEvent)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
