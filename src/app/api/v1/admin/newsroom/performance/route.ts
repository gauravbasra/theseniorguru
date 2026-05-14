import { NextResponse } from "next/server";
import {
  getContentPerformanceSummary,
  recordContentPerformanceMetric
} from "@/lib/newsroom/newsroom";
import type { ContentPerformanceSubjectType } from "@/lib/domain/newsroom";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const subjectType = url.searchParams.get("subjectType") ?? undefined;
    const subjectId = url.searchParams.get("subjectId") ?? undefined;
    const channel = url.searchParams.get("channel") ?? undefined;

    return NextResponse.json({
      data: await getContentPerformanceSummary({
        subjectType: subjectType as ContentPerformanceSubjectType | undefined,
        subjectId,
        channel
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.subjectType || !body.subjectId || !body.metricKey) {
      return NextResponse.json({ error: "subjectType, subjectId, and metricKey are required" }, { status: 422 });
    }

    const metric = await recordContentPerformanceMetric({
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      channel: body.channel,
      metricKey: body.metricKey,
      metricValue: body.metricValue,
      metricPayload: body.metricPayload,
      recordedAt: body.recordedAt
    });

    return NextResponse.json({ data: metric }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") || message.includes("required") || message.includes("must be")
      ? 422
      : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
