import { NextResponse } from "next/server";
import { exportApiUsageAnalytics, getApiUsageAnalytics } from "@/lib/openapi/platform";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowDays = Number(searchParams.get("windowDays") ?? 30);
    const input = {
      apiClientId: searchParams.get("apiClientId") ?? undefined,
      windowDays: Number.isFinite(windowDays) ? windowDays : 30
    };

    if (searchParams.get("format") === "csv") {
      const exportPayload = await exportApiUsageAnalytics(input);

      return new NextResponse(exportPayload.csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json({
      data: await getApiUsageAnalytics(input)
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
