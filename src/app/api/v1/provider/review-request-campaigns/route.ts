import { NextResponse } from "next/server";
import { createReviewRequestCampaign, listReviewRequestCampaigns } from "@/lib/reviews/review-campaigns";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({ data: await listReviewRequestCampaigns(searchParams.get("providerId") ?? undefined) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.providerId || !body.name || !Array.isArray(body.recipients)) {
      return NextResponse.json({ error: "providerId, name, and recipients are required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createReviewRequestCampaign(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
