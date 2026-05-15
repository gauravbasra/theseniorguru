import { NextResponse } from "next/server";
import { getCutoverSmokeChecklist, recordCutoverSmokeChecklist } from "@/lib/system/dns-cutover-smoke-checklist";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dryRun = searchParams.get("dryRun") !== "false";

    return NextResponse.json({ data: await getCutoverSmokeChecklist(dryRun) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;

    return NextResponse.json({
      data: await recordCutoverSmokeChecklist({
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
        notes: typeof body.notes === "string" ? body.notes : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
