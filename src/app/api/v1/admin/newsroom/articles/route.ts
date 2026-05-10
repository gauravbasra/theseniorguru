import { NextResponse } from "next/server";
import { createArticleDraft } from "@/lib/newsroom/newsroom";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.byline || !body.title) {
      return NextResponse.json({ error: "byline and title are required" }, { status: 422 });
    }

    const article = await createArticleDraft({
      newsItemId: body.newsItemId,
      byline: body.byline,
      title: body.title,
      dek: body.dek,
      sourceLinks: body.sourceLinks
    });

    return NextResponse.json({ data: article }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

