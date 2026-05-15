import { NextResponse, type NextRequest } from "next/server";
import { addCareCircleMember, listCareCircleMembers, listCareCircles } from "@/lib/mobile/stickiness";
import { resolveAppUserKey } from "@/lib/mobile/session";

async function assertOwnedCareCircle(request: NextRequest, careCircleId: string, explicitUserKey?: unknown) {
  const userKey = await resolveAppUserKey(request, explicitUserKey);
  const circles = await listCareCircles(userKey);

  if (!circles.some((circle) => circle.id === careCircleId)) {
    throw new Error("Care circle not found for app session");
  }

  return userKey;
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    await assertOwnedCareCircle(request, id, searchParams.get("userKey"));

    return NextResponse.json({ data: await listCareCircleMembers(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("not found") ? 422 : 500 });
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    await assertOwnedCareCircle(request, id, body.userKey);

    if (!body.displayName) {
      return NextResponse.json({ error: "displayName is required" }, { status: 422 });
    }

    return NextResponse.json(
      {
        data: await addCareCircleMember({
          careCircleId: id,
          displayName: body.displayName,
          email: body.email,
          role: body.role
        })
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("not found") ? 422 : 500 });
  }
}
