import { NextResponse } from "next/server";
import { moderateReview } from "@/lib/reviews/reviews";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.status || !body.reason) {
      return NextResponse.json({ error: "status and reason are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await moderateReview({
        reviewId: id,
        status: body.status,
        reason: body.reason,
        notes: body.notes,
        actorId: body.actorId
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Review not found" ? 404 : 500 });
  }
}
