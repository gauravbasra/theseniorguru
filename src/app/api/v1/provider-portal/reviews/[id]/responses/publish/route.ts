import { NextResponse } from "next/server";
import { ReviewResponsePublishError, publishReviewResponse } from "@/lib/reviews/reviews";

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
          actorId: body.actorId,
          dryRun: body.dryRun === false ? false : true
        })
      },
      { status: body.dryRun === false ? 201 : 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = error instanceof ReviewResponsePublishError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
