import { NextResponse } from "next/server";
import { ArticlePublishError, publishArticle } from "@/lib/newsroom/newsroom";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await publishArticle({
        articleId: id,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        dryRun: body.dryRun === false ? false : true
      })
    });
  } catch (error) {
    const status = error instanceof ArticlePublishError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status });
  }
}
