import { NextResponse } from "next/server";
import { assignExtractedEntityReview } from "@/lib/aggregation/extracted-entities";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (!body.assignedTo || typeof body.assignedTo !== "string") {
      return NextResponse.json({ error: "assignedTo is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await assignExtractedEntityReview({
        entityId: id,
        assignedTo: body.assignedTo,
        assignedBy: body.assignedBy ?? body.actorId,
        route: body.route,
        dueAt: body.dueAt,
        notes: body.notes
      })
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Extracted entity not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
