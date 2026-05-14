import { NextResponse } from "next/server";
import { getExtractedEntityMergeReadiness } from "@/lib/aggregation/extracted-entities";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await getExtractedEntityMergeReadiness({
        entityId: id,
        matchedProviderId: typeof body.matchedProviderId === "string" ? body.matchedProviderId : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        recordAudit: body.recordAudit === true
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Extracted entity not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
