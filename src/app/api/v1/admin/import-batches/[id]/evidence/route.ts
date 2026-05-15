import { NextResponse } from "next/server";
import { exportImportBatchEvidence } from "@/lib/aggregation/import-batch-evidence";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const format = new URL(request.url).searchParams.get("format") === "csv" ? "csv" : "json";
    const data = await exportImportBatchEvidence(id, format);

    if (format === "csv") {
      return new NextResponse(data.csv ?? "", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="import-batch-${id}-evidence.csv"`
        }
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Import batch not found" ? 404 : 500 });
  }
}
