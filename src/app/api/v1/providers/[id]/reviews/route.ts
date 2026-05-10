import { NextResponse } from "next/server";
import { createProviderReview, listProviderReviews } from "@/lib/reviews/reviews";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await listProviderReviews(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.reviewerName || !body.rating) {
      return NextResponse.json({ error: "reviewerName and rating are required" }, { status: 422 });
    }

    const review = await createProviderReview({
      providerId: id,
      reviewerName: body.reviewerName,
      reviewerEmail: body.reviewerEmail,
      rating: Number(body.rating),
      title: body.title,
      body: body.body
    });

    return NextResponse.json({ data: review }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Provider not found" ? 404 : 500 });
  }
}

