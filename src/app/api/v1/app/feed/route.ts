import { NextResponse } from "next/server";
import { getAppFeed } from "@/lib/community/feed";

export async function GET() {
  try {
    return NextResponse.json({ data: await getAppFeed() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

