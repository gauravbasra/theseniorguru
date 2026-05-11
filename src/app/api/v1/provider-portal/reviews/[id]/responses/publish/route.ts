import { NextResponse } from "next/server";
import { publishReviewResponse } from "@/lib/reviews/reviews";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.body || !body.providerId) {
      return NextResponse.json({ error: "body and providerId are required" }, { status: 422 });
    }

    return NextResponse.json(
      {
        data: await publishReviewResponse({
          reviewId: id,
          providerId: body.providerId,
          body: body.body,
          generatedByAi: body.generatedByAi,
          actorId: body.actorId
        })
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Review not found" || message === "Provider not found"
        ? 404
        : message.includes("provider mismatch")
          ? 403
          : message.includes("must be published")
            ? 409
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
