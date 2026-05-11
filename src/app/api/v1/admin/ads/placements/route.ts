import { NextResponse } from "next/server";
import { listAdPlacements, upsertAdPlacement } from "@/lib/ads/ads";

export async function GET() {
  try {
    return NextResponse.json({ data: await listAdPlacements() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.placementKey || !body.name || !body.surface) {
      return NextResponse.json({ error: "placementKey, name, and surface are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await upsertAdPlacement({
        placementKey: body.placementKey,
        name: body.name,
        surface: body.surface,
        description: body.description,
        disclosureRequired: body.disclosureRequired,
        disclosureLabel: body.disclosureLabel,
        isActive: body.isActive,
        actorId: body.actorId
      })
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
