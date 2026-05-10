import { NextResponse } from "next/server";
import { createCommunityPost } from "@/lib/community/moderation";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createCommunityPost(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

