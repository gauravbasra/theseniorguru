import { NextResponse } from "next/server";
import {
  exportWebhookSdkPublishReadinessCsv,
  getWebhookSdkPublishReadiness
} from "@/lib/openapi/developer-docs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("format") === "csv") {
      const exportPayload = exportWebhookSdkPublishReadinessCsv();

      return new NextResponse(exportPayload.csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json({ data: getWebhookSdkPublishReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
