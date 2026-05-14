import { NextResponse } from "next/server";
import { exportProviderWebsiteParserRuleImpactEvidence } from "@/lib/aggregation/provider-website-parser";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "json";
    const limit = Number(url.searchParams.get("limit") ?? 100);

    if (format !== "json" && format !== "csv") {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 422 });
    }

    const exportPayload = await exportProviderWebsiteParserRuleImpactEvidence({
      dataSourceId: url.searchParams.get("dataSourceId") ?? undefined,
      limit: Number.isFinite(limit) ? limit : 100
    });

    if (format === "csv") {
      return new NextResponse(exportPayload.csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": "attachment; filename=\"senior-guru-parser-impact-evidence.csv\""
        }
      });
    }

    return NextResponse.json({ data: exportPayload });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("must be") ? 422 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
