import { NextResponse } from "next/server";
import { requeueImportBatch } from "@/lib/import-batches";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await requeueImportBatch(id, {
        actorId: body.actorId,
        reason: body.reason
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
