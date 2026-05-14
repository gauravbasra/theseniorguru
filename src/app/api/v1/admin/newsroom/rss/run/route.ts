import { NextResponse } from "next/server";
import { runScheduledRssImports } from "@/lib/newsroom/newsroom";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runScheduledRssImports({
      dryRun: body.dryRun,
      limit: body.limit,
      contentSourceIds: body.contentSourceIds,
      items: body.items
    });

    return NextResponse.json({ data: result }, { status: body.dryRun ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
