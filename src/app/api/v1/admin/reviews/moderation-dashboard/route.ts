import { NextResponse } from "next/server";
import { getReviewModerationDashboard } from "@/lib/reviews/reviews";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    return NextResponse.json({
      data: await getReviewModerationDashboard({
        providerId: searchParams.get("providerId") ?? undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
