import { NextResponse } from "next/server";
import { createAdCreative } from "@/lib/ads/ads";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.placementKey || !body.campaignName || !body.headline) {
      return NextResponse.json({ error: "placementKey, campaignName, and headline are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await createAdCreative({
        placementKey: body.placementKey,
        providerId: body.providerId,
        campaignName: body.campaignName,
        headline: body.headline,
        body: body.body,
        imageUrl: body.imageUrl,
        destinationUrl: body.destinationUrl,
        disclosureLabel: body.disclosureLabel,
        budgetCents: body.budgetCents,
        targetingRules: body.targetingRules,
        creativePayload: body.creativePayload,
        activate: body.activate,
        actorId: body.actorId
      })
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
