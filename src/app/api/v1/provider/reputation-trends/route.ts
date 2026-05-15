import { NextResponse } from "next/server";
import {
  getProviderReputationTrends,
  recordProviderReputationTrendSnapshot
} from "@/lib/reviews/reputation-trends";
import type { ReputationTrendBucket } from "@/lib/domain/reviews";

function parseBucket(value: string | null): ReputationTrendBucket | undefined {
  if (value === "daily" || value === "weekly" || value === "monthly") {
    return value;
  }

  return undefined;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await getProviderReputationTrends({
        providerId,
        windowDays: Number(searchParams.get("windowDays") ?? 90),
        bucket: parseBucket(searchParams.get("bucket"))
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Provider not found" ? 404 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await recordProviderReputationTrendSnapshot({
        providerId: body.providerId,
        windowDays: Number(body.windowDays ?? 90),
        bucket: parseBucket(body.bucket),
        actorId: body.actorId
      })
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Provider not found" ? 404 : 500 });
  }
}
