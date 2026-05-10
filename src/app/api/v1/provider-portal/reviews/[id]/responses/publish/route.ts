import { NextResponse } from "next/server";
import { publishReviewResponse } from "@/lib/reviews/reviews";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.body) {
      return NextResponse.json({ error: "body is required" }, { status: 422 });
    }

    return NextResponse.json(
      {
        data: await publishReviewResponse({
          reviewId: id,
          body: body.body,
          generatedByAi: body.generatedByAi,
          actorId: body.actorId
        })
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Review not found" ? 404 : 500 });
  }
}
