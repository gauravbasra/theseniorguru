import { NextResponse } from "next/server";
import { createTourPlan, listTourPlans } from "@/lib/mobile/stickiness";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userKey = searchParams.get("userKey");

    if (!userKey) {
      return NextResponse.json({ error: "userKey is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await listTourPlans(userKey) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.userKey || !body.providerId) {
      return NextResponse.json({ error: "userKey and providerId are required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createTourPlan(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
