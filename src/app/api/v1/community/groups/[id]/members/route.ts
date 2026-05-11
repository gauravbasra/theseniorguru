import { NextResponse } from "next/server";
import { joinCommunityGroup, listCommunityGroupMembers } from "@/lib/community/groups";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await listCommunityGroupMembers(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.userKey) {
      return NextResponse.json({ error: "userKey is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await joinCommunityGroup({
        communityId: id,
        userKey: body.userKey,
        displayName: body.displayName,
        email: body.email,
        role: body.role,
        actorId: body.actorId
      })
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
