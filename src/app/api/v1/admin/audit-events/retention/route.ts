import { NextResponse } from "next/server";
import { getAuditRetentionControls } from "@/lib/audit-events";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const retentionDays = Number(searchParams.get("retentionDays") ?? 2555);
    const limit = Number(searchParams.get("limit") ?? 250);

    return NextResponse.json({
      data: await getAuditRetentionControls({
        retentionDays: Number.isFinite(retentionDays) ? retentionDays : 2555,
        dryRun: true,
        limit: Number.isFinite(limit) ? limit : 250
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await getAuditRetentionControls({
      retentionDays: Number.isFinite(Number(body.retentionDays)) ? Number(body.retentionDays) : 2555,
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
      limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : 250
    });

    return NextResponse.json({ data: result }, { status: result.status === "blocked" ? 422 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
