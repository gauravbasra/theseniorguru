import { NextResponse } from "next/server";
import { exportWebhookReplayEvidence } from "@/lib/openapi/platform";

const allowedFormats = ["json", "csv"] as const;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const limit = Number(searchParams.get("limit") ?? 100);

    if (!allowedFormats.includes(format as (typeof allowedFormats)[number])) {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 422 });
    }

    const exportPayload = await exportWebhookReplayEvidence({
      format: format as "json" | "csv",
      limit: Number.isFinite(limit) ? limit : 100,
      apiClientId: searchParams.get("apiClientId") ?? undefined
    });

    if (format === "csv") {
      return new NextResponse(exportPayload.csv ?? "", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json({ data: exportPayload });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
