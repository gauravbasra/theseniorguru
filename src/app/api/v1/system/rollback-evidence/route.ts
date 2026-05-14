import { NextResponse } from "next/server";
import { getRollbackEvidence, type RollbackEvidenceFormat } from "@/lib/system/rollback-evidence";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") === "csv" ? "csv" : "json";
    const data = await getRollbackEvidence(format as RollbackEvidenceFormat);

    if (format === "csv") {
      return new NextResponse(data.csv ?? "", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="senior-guru-rollback-evidence-${data.generatedAt.slice(0, 10)}.csv"`
        }
      });
    }

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
