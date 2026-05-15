import { NextResponse } from "next/server";
import { sendReviewRequestCampaign } from "@/lib/reviews/review-campaigns";

const allowedProviders = new Set(["internal_notification_queue", "manual_export", "mailjet", "google", "manual", "pending"]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (body.deliveryProvider && !allowedProviders.has(body.deliveryProvider)) {
      return NextResponse.json(
        { error: "deliveryProvider must be internal_notification_queue, manual_export, mailjet, google, manual, or pending" },
        { status: 422 }
      );
    }

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
