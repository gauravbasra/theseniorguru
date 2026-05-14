import { NextResponse } from "next/server";
import type {
  ContentPerformanceSubjectType,
  ContentPerformanceTrendBucket
} from "@/lib/domain/newsroom";
import { getContentPerformanceTrendExport } from "@/lib/newsroom/newsroom";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const subjectType = url.searchParams.get("subjectType") ?? undefined;
    const subjectId = url.searchParams.get("subjectId") ?? undefined;
    const channel = url.searchParams.get("channel") ?? undefined;
    const bucket = url.searchParams.get("bucket") ?? undefined;
    const format = url.searchParams.get("format") ?? "json";

    if (bucket && bucket !== "day" && bucket !== "week") {
      return NextResponse.json({ error: "bucket must be day or week" }, { status: 422 });
    }

    if (format !== "json" && format !== "csv") {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 422 });
    }

    const exportPayload = await getContentPerformanceTrendExport({
      subjectType: subjectType as ContentPerformanceSubjectType | undefined,
      subjectId,
      channel,
      bucket: bucket as ContentPerformanceTrendBucket | undefined
    });

    if (format === "csv") {
      return new NextResponse(exportPayload.csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="senior-guru-newsroom-performance-${exportPayload.filters.bucket}.csv"`
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
