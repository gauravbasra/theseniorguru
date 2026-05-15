import { NextResponse } from "next/server";
import { exportPolicyReviewDecisionDashboardCsv, getPolicyReviewDecisionDashboard } from "@/lib/policy";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 100);
    const input = { limit: Number.isFinite(limit) ? limit : 100 };

    if (searchParams.get("format") === "csv") {
      const exportPayload = await exportPolicyReviewDecisionDashboardCsv(input);

      return new NextResponse(exportPayload.csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json({ data: await getPolicyReviewDecisionDashboard(input) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
