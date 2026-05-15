import { NextResponse } from "next/server";
import { CampaignPublishError, publishCampaign } from "@/lib/campaigns/campaigns";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({
      data: await publishCampaign({
        campaignId: id,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        dryRun: body.dryRun === false ? false : true
      })
    });
  } catch (error) {
    const status = error instanceof CampaignPublishError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status });
  }
}
