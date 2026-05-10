import { NextResponse } from "next/server";
import { createCampaign, listCampaigns } from "@/lib/campaigns/campaigns";

export async function GET() {
  try {
    return NextResponse.json({ data: await listCampaigns() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.campaignType) {
      return NextResponse.json({ error: "name and campaignType are required" }, { status: 422 });
    }

    const campaign = await createCampaign({
      providerId: body.providerId,
      campaignType: body.campaignType,
      name: body.name,
      objective: body.objective,
      audience: body.audience,
      channels: body.channels,
      startsAt: body.startsAt,
      endsAt: body.endsAt
    });

    return NextResponse.json({ data: campaign }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

