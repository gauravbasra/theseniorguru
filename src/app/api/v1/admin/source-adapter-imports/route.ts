import { NextResponse } from "next/server";
import {
  getSourceAdapterImportReadiness,
  runSourceAdapterImport
} from "@/lib/aggregation/source-adapter-imports";

export async function GET() {
  try {
    return NextResponse.json({ data: await getSourceAdapterImportReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.dataSourceId || !Array.isArray(body.records)) {
      return NextResponse.json({ error: "dataSourceId and records are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await runSourceAdapterImport({
        dataSourceId: body.dataSourceId,
        records: body.records,
        dryRun: body.dryRun !== false,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        batchName: typeof body.batchName === "string" ? body.batchName : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
