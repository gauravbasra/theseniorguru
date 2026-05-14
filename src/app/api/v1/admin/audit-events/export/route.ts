import { NextResponse } from "next/server";
import type { AuditEventExportFormat } from "@/lib/domain/audit";
import { exportAuditEvents } from "@/lib/audit-events";

const allowedFormats: AuditEventExportFormat[] = ["json", "csv"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const limit = Number(searchParams.get("limit") ?? 250);
    const retentionDays = Number(searchParams.get("retentionDays") ?? 2555);

    if (!allowedFormats.includes(format as AuditEventExportFormat)) {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 422 });
    }

    const exportPayload = await exportAuditEvents({
      eventType: searchParams.get("eventType") ?? undefined,
      subjectType: searchParams.get("subjectType") ?? undefined,
      actorType: searchParams.get("actorType") ?? undefined,
      createdBefore: searchParams.get("createdBefore") ?? undefined,
      format: format as AuditEventExportFormat,
      retentionDays: Number.isFinite(retentionDays) ? retentionDays : 2555,
      limit: Number.isFinite(limit) ? limit : 250
    });

    if (format === "csv") {
      return new NextResponse(exportPayload.csv ?? "", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="senior-guru-audit-events-${new Date().toISOString().slice(0, 10)}.csv"`
        }
      });
    }

    return NextResponse.json({ data: exportPayload });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
