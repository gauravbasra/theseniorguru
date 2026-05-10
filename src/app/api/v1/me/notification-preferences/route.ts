import { NextResponse } from "next/server";
import { getNotificationPreferences, updateNotificationPreferences } from "@/lib/mobile/stickiness";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userKey = searchParams.get("userKey");

    if (!userKey) {
      return NextResponse.json({ error: "userKey is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await getNotificationPreferences(userKey) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    if (!body.userKey) {
      return NextResponse.json({ error: "userKey is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await updateNotificationPreferences(body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
