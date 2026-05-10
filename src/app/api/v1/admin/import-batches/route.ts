import { NextResponse } from "next/server";
import { createImportBatch, listImportBatches } from "@/lib/import-batches";

export async function GET() {
  try {
    return NextResponse.json({ data: await listImportBatches() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.sourceKind) {
      return NextResponse.json({ error: "name and sourceKind are required" }, { status: 422 });
    }

    const batch = await createImportBatch({
      dataSourceId: body.dataSourceId,
      name: body.name,
      sourceKind: body.sourceKind,
      estimatedRecords: body.estimatedRecords
    });

    return NextResponse.json({ data: batch }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

