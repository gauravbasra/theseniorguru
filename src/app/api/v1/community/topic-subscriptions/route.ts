import { NextResponse } from "next/server";
import { listCommunityTopicSubscriptions, upsertCommunityTopicSubscription } from "@/lib/community/groups";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    return NextResponse.json({
      data: await listCommunityTopicSubscriptions({
        userKey: searchParams.get("userKey") ?? undefined,
        city: searchParams.get("city") ?? undefined,
        state: searchParams.get("state") ?? undefined,
        status: (searchParams.get("status") as "active" | "paused" | "removed" | null) ?? undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.userKey || !body.topicKey) {
      return NextResponse.json({ error: "userKey and topicKey are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await upsertCommunityTopicSubscription({
        userKey: body.userKey,
        topicKey: body.topicKey,
        topicLabel: body.topicLabel,
        city: body.city,
        state: body.state,
        status: body.status,
        actorId: body.actorId
      })
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
