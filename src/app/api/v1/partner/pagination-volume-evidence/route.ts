import { NextResponse } from "next/server";
import {
  exportPartnerPaginationVolumeEvidenceCsv,
  getPartnerPaginationVolumeEvidence
} from "@/lib/openapi/developer-docs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  if (searchParams.get("format") === "csv") {
    const exportPayload = exportPartnerPaginationVolumeEvidenceCsv();

    return new NextResponse(exportPayload.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${exportPayload.filename}"`
      }
    });
  }

  return NextResponse.json({ data: getPartnerPaginationVolumeEvidence() });
}
