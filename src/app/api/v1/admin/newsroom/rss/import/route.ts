import { NextResponse } from "next/server";
import { importRssFeed } from "@/lib/newsroom/newsroom";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await importRssFeed({
      contentSourceId: body.contentSourceId,
      feedUrl: body.feedUrl,
      sourceName: body.sourceName,
      audience: body.audience,
      topicTags: body.topicTags,
      limit: body.limit,
      dryRun: body.dryRun !== false,
      items: body.items
    });

    return NextResponse.json({ data: result }, { status: result.dryRun ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
