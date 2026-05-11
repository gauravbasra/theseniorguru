import { NextResponse } from "next/server";
import { createContentSource, listContentSources } from "@/lib/newsroom/newsroom";

export async function GET() {
  try {
    return NextResponse.json({ data: await listContentSources() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.sourceType) {
      return NextResponse.json({ error: "name and sourceType are required" }, { status: 422 });
    }

    const source = await createContentSource({
      name: body.name,
      sourceType: body.sourceType,
      url: body.url,
      reviewStatus: body.reviewStatus,
      copyrightNotes: body.copyrightNotes
    });

    return NextResponse.json({ data: source }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
