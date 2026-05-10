import { NextResponse } from "next/server";
import { listReviewRequests } from "@/lib/reviews/review-campaigns";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({ data: await listReviewRequests(searchParams.get("providerId") ?? undefined) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
