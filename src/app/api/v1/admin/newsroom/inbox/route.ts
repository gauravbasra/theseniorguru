import { NextResponse } from "next/server";
import { createNewsItem, listNewsItems } from "@/lib/newsroom/newsroom";

export async function GET() {
  try {
    return NextResponse.json({ data: await listNewsItems() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 422 });
    }

    const item = await createNewsItem({
      contentSourceId: body.contentSourceId,
      title: body.title,
      sourceUrl: body.sourceUrl,
      sourceName: body.sourceName,
      summary: body.summary,
      audience: body.audience,
      topicTags: body.topicTags
    });

    return NextResponse.json({ data: item }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
