import { NextResponse } from "next/server";
import { createCommunityInvitation, listCommunityInvitations } from "@/lib/community/groups";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await listCommunityInvitations(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.inviterUserKey || !body.recipientEmail) {
      return NextResponse.json({ error: "inviterUserKey and recipientEmail are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await createCommunityInvitation({
        communityId: id,
        inviterUserKey: body.inviterUserKey,
        recipientEmail: body.recipientEmail,
        recipientName: body.recipientName,
        role: body.role,
        deliveryChannel: body.deliveryChannel,
        actorId: body.actorId
      })
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
