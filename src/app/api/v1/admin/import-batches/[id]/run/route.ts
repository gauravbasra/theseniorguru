import { NextResponse } from "next/server";
import { runImportBatch } from "@/lib/aggregation/import-worker";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!Array.isArray(body.records)) {
      return NextResponse.json({ error: "records must be an array" }, { status: 422 });
    }

    return NextResponse.json({
      data: await runImportBatch(id, {
        records: body.records,
        actorId: body.actorId,
        dryRun: body.dryRun !== false
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
