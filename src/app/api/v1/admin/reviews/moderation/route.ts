import { NextResponse } from "next/server";
import type { ReviewRecord } from "@/lib/domain/reviews";
import { listReviewModerationQueue } from "@/lib/reviews/reviews";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const providerId = url.searchParams.get("providerId") ?? undefined;
    const status = url.searchParams.get("status") as ReviewRecord["status"] | null;

    return NextResponse.json({
      data: await listReviewModerationQueue({
        providerId,
        status: status ?? "pending_moderation"
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
