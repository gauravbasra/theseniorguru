import { NextResponse } from "next/server";
import { sendReviewRequestCampaign } from "@/lib/reviews/review-campaigns";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await sendReviewRequestCampaign({
        campaignId: id,
        actorId: body.actorId,
        limit: body.limit,
        dryRun: body.dryRun,
        deliveryProvider: body.deliveryProvider
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
