import { NextResponse } from "next/server";
import { addCareCircleMember, listCareCircleMembers } from "@/lib/mobile/stickiness";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await listCareCircleMembers(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

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
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

