import { NextResponse } from "next/server";
import { decideExtractedEntity } from "@/lib/aggregation/extracted-entities";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await decideExtractedEntity({
        entityId: id,
        decision: "rejected",
        actorId: body.actorId,
        adminNotes: body.adminNotes,
        dryRun: body.dryRun !== false
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
