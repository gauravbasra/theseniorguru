import { NextResponse } from "next/server";
import { sendCommunityInvitation } from "@/lib/community/groups";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await sendCommunityInvitation({
        invitationId: id,
        deliveryChannel: body.deliveryChannel,
        deliveryProvider: body.deliveryProvider,
        deliveryId: body.deliveryId,
        actorId: body.actorId,
        dryRun: body.dryRun === false ? false : true
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
