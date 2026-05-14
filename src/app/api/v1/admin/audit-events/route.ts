import { NextResponse } from "next/server";
import { listAuditEvents } from "@/lib/audit-events";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 100);

    return NextResponse.json({
      data: await listAuditEvents({
        eventType: searchParams.get("eventType") ?? undefined,
        subjectType: searchParams.get("subjectType") ?? undefined,
        actorType: searchParams.get("actorType") ?? undefined,
        limit: Number.isFinite(limit) ? limit : 100
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
