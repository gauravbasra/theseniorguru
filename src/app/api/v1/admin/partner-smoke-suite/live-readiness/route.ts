import { NextResponse } from "next/server";
import {
  exportPartnerLiveSmokeExecutionReadinessCsv,
  getPartnerLiveSmokeExecutionReadiness
} from "@/lib/openapi/partner-smoke-suite";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("format") === "csv") {
      const exportPayload = await exportPartnerLiveSmokeExecutionReadinessCsv();

      return new NextResponse(exportPayload.csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json({ data: await getPartnerLiveSmokeExecutionReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
