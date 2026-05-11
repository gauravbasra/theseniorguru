import { NextResponse } from "next/server";
import { getAdCampaignReporting } from "@/lib/ads/ads";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    return NextResponse.json({
      data: await getAdCampaignReporting({
        placementKey: url.searchParams.get("placementKey") ?? undefined,
        providerId: url.searchParams.get("providerId") ?? undefined,
        from: url.searchParams.get("from") ?? undefined,
        to: url.searchParams.get("to") ?? undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
