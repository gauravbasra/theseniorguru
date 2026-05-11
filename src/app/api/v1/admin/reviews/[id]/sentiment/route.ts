import { NextResponse } from "next/server";
import { scoreReviewSentiment } from "@/lib/reviews/reviews";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    return NextResponse.json({ data: await scoreReviewSentiment(id) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Review not found" ? 404 : 500 });
  }
}
