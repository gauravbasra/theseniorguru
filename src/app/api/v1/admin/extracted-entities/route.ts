import { NextResponse } from "next/server";
import { createExtractedEntity, listExtractedEntities } from "@/lib/aggregation/extracted-entities";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({ data: await listExtractedEntities(searchParams.get("status") ?? "pending") });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json({ data: await createExtractedEntity(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

