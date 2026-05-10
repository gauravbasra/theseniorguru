import { NextResponse } from "next/server";
import { createCommunityReport } from "@/lib/community/moderation";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.subjectType || !body.subjectId || !body.reason) {
      return NextResponse.json({ error: "subjectType, subjectId, and reason are required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createCommunityReport(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

