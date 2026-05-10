import { NextResponse } from "next/server";
import { generateReviewResponse } from "@/lib/reviews/reviews";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await generateReviewResponse(id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

