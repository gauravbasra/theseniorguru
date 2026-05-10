import { NextResponse } from "next/server";
import { listCommunityPosts } from "@/lib/community/feed";

export async function GET() {
  try {
    return NextResponse.json({ data: await listCommunityPosts() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

