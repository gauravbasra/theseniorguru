import { NextResponse } from "next/server";
import {
  getPostCutoverMonitorAlertPreview,
  sendPostCutoverMonitorAlert,
  summarizePostCutoverMonitorAlertAudit,
  type PostCutoverMonitorAlertProvider
} from "@/lib/system/post-cutover-monitor-alerts";

function parseProvider(value: unknown): PostCutoverMonitorAlertProvider {
  return value === "internal_notification_queue" ? "internal_notification_queue" : "manual_export";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getPostCutoverMonitorAlertPreview({
      deliveryProvider: parseProvider(searchParams.get("deliveryProvider"))
    });

    return NextResponse.json({
      data: {
        ...data,
        latestAuditEvent: summarizePostCutoverMonitorAlertAudit(data.latestAuditEvent)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await sendPostCutoverMonitorAlert({
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      deliveryProvider: parseProvider(body.deliveryProvider),
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
      notes: typeof body.notes === "string" ? body.notes : undefined
    });

    return NextResponse.json({
      data: {
        ...data,
        latestAuditEvent: summarizePostCutoverMonitorAlertAudit(data.latestAuditEvent)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
