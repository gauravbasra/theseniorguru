import { NextResponse } from "next/server";
import { generateArticlePodcastBrief } from "@/lib/newsroom/newsroom";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ data: await generateArticlePodcastBrief(id) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
