import { NextResponse } from "next/server";
import { createCommunityGroup, listCommunityGroups } from "@/lib/community/groups";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      data: await listCommunityGroups({
        city: searchParams.get("city") ?? undefined,
        state: searchParams.get("state") ?? undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createCommunityGroup(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
