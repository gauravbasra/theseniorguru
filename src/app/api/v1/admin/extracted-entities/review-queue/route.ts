import { NextResponse } from "next/server";
import { getExtractedEntityReviewQueue } from "@/lib/aggregation/extracted-entities";
import type { ExtractedEntityReviewStatus } from "@/lib/domain/entities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const minImages = searchParams.get("minImages");

    return NextResponse.json({
      data: await getExtractedEntityReviewQueue({
        status: (searchParams.get("status") ?? "all") as ExtractedEntityReviewStatus | "all",
        limit: limit ? Number(limit) : undefined,
        minImages: minImages ? Number(minImages) : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
