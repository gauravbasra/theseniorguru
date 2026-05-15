import { NextResponse } from "next/server";
import { getPublicDomainSmoke, recordPublicDomainSmoke, summarizePublicDomainSmokeAudit } from "@/lib/system/public-domain-smoke";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getPublicDomainSmoke({
      targetUrl: searchParams.get("targetUrl") ?? undefined
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const data = await recordPublicDomainSmoke({
      actorId: typeof body.actorId === "string" ? body.actorId : undefined,
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
      targetUrl: typeof body.targetUrl === "string" ? body.targetUrl : undefined,
      notes: typeof body.notes === "string" ? body.notes : undefined
    });

    return NextResponse.json({
      data: {
        ...data,
        auditEvent: summarizePublicDomainSmokeAudit(data.auditEvent)
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
