import { NextResponse } from "next/server";
import { moderateCommunitySubject } from "@/lib/community/moderation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.status) {
      return NextResponse.json({ error: "status is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await moderateCommunitySubject({
        subjectType: "community_comment",
        subjectId: id,
        status: body.status,
        reason: body.reason,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

