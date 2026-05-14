import { NextResponse } from "next/server";
import { getExtractedEntityReviewEscalations } from "@/lib/aggregation/extracted-entities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const minImages = searchParams.get("minImages");

    return NextResponse.json({
      data: await getExtractedEntityReviewEscalations({
        limit: limit ? Number(limit) : undefined,
        minImages: minImages ? Number(minImages) : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
