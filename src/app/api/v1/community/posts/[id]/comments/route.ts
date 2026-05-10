import { NextResponse } from "next/server";
import { createCommunityComment, listCommunityComments } from "@/lib/community/moderation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await listCommunityComments(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.body) {
      return NextResponse.json({ error: "body is required" }, { status: 422 });
    }

    return NextResponse.json(
      {
        data: await createCommunityComment({
          postId: id,
          authorName: body.authorName,
          body: body.body
        })
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

