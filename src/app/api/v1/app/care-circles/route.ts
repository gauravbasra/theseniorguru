import { NextResponse, type NextRequest } from "next/server";
import { createCareCircle, listCareCircles } from "@/lib/mobile/stickiness";
import { resolveAppUserKey } from "@/lib/mobile/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userKey = await resolveAppUserKey(request, searchParams.get("userKey"));

    return NextResponse.json({ data: await listCareCircles(userKey) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("does not match") ? 422 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const ownerUserKey = await resolveAppUserKey(request, body.ownerUserKey);

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createCareCircle({ ...body, ownerUserKey }) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("does not match") ? 422 : 500 });
  }
}
