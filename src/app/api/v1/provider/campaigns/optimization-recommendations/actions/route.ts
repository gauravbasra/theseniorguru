import { NextResponse } from "next/server";
import { actOnCampaignOptimizationRecommendation } from "@/lib/campaigns/campaigns";

const allowedActionTypes = new Set(["create_task", "queue_internal", "mark_reviewed", "dismiss"]);

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.recommendationId || !body.actionType) {
      return NextResponse.json({ error: "recommendationId and actionType are required" }, { status: 422 });
    }

    if (!allowedActionTypes.has(body.actionType)) {
      return NextResponse.json(
        { error: "actionType must be create_task, queue_internal, mark_reviewed, or dismiss" },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        data: await actOnCampaignOptimizationRecommendation({
          providerId: body.providerId,
          recommendationId: body.recommendationId,
          actionType: body.actionType,
          actorId: body.actorId,
          notes: body.notes,
          dueAt: body.dueAt
        })
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Campaign recommendation not found" ? 404 : message.includes("required") || message.includes("must be") ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
