import { NextResponse } from "next/server";
import {
  exportDuplicateMergeReviewDashboardCsv,
  getDuplicateMergeReviewDashboard
} from "@/lib/aggregation/extracted-entities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 100);
    const minImages = Number(searchParams.get("minImages") ?? 3);
    const input = {
      limit: Number.isFinite(limit) ? limit : 100,
      minImages: Number.isFinite(minImages) ? minImages : 3
    };

    if (searchParams.get("format") === "csv") {
      const exportPayload = await exportDuplicateMergeReviewDashboardCsv(input);

      return new NextResponse(exportPayload.csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json({ data: await getDuplicateMergeReviewDashboard(input) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
