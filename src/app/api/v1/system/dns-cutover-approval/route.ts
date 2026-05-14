import { NextResponse } from "next/server";
import { getDnsCutoverApprovalSummary, recordDnsCutoverApproval } from "@/lib/system/dns-cutover-approval";
import { getProductionCutoverReadiness } from "@/lib/system/production-cutover";

export async function GET() {
  try {
    return NextResponse.json({ data: await getDnsCutoverApprovalSummary() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const readiness = await getProductionCutoverReadiness();
    const data = await recordDnsCutoverApproval(
      {
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        ownerName: typeof body.ownerName === "string" ? body.ownerName : undefined,
        ownerApproved: body.ownerApproved === true,
        targetDomain: typeof body.targetDomain === "string" ? body.targetDomain : undefined,
        plannedWindowStart: typeof body.plannedWindowStart === "string" ? body.plannedWindowStart : undefined,
        plannedWindowEnd: typeof body.plannedWindowEnd === "string" ? body.plannedWindowEnd : undefined,
        rollbackAcknowledged: body.rollbackAcknowledged === true,
        approvalNotes: typeof body.approvalNotes === "string" ? body.approvalNotes : undefined
      },
      readiness
    );

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
