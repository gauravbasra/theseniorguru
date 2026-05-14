import { NextResponse } from "next/server";
import { getProviderCampaignMetrics } from "@/lib/campaigns/campaigns";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId") ?? undefined;

    return NextResponse.json({ data: await getProviderCampaignMetrics(providerId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
