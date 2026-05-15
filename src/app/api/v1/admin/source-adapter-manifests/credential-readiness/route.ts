import { NextResponse } from "next/server";
import {
  exportSourceManifestCredentialReadinessCsv,
  getSourceManifestCredentialReadiness
} from "@/lib/aggregation/source-manifest-credential-readiness";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    if (searchParams.get("format") === "csv") {
      const exportPayload = await exportSourceManifestCredentialReadinessCsv();

      return new NextResponse(exportPayload.csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json({ data: await getSourceManifestCredentialReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
