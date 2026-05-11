import { NextResponse } from "next/server";
import { listExpertProfiles, submitExpertProfile } from "@/lib/community/experts";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({
      data: await listExpertProfiles({
        status: searchParams.get("status") as never,
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

    if (!body.userKey || !body.displayName || !body.specialty) {
      return NextResponse.json({ error: "userKey, displayName, and specialty are required" }, { status: 422 });
    }

    return NextResponse.json({ data: await submitExpertProfile(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
