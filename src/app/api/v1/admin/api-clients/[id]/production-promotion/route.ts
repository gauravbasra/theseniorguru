import { NextResponse } from "next/server";
import { reviewApiClientProductionPromotion } from "@/lib/openapi/platform";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await reviewApiClientProductionPromotion({
        apiClientId: id,
        actorId: typeof body.actorId === "string" ? body.actorId : "admin_console",
        ownerApproved: body.ownerApproved === true,
        approvalNotes: typeof body.approvalNotes === "string" ? body.approvalNotes : undefined,
        dryRun: body.dryRun === undefined ? undefined : body.dryRun !== false,
        windowDays: body.windowDays ? Number(body.windowDays) : undefined
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
