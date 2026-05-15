import { NextResponse } from "next/server";
import { getProviderAdCampaignDashboard } from "@/lib/ads/ads";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await getProviderAdCampaignDashboard({
        providerId,
        placementKey: searchParams.get("placementKey") ?? undefined,
        from: searchParams.get("from") ?? undefined,
        to: searchParams.get("to") ?? undefined
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Provider not found" ? 404 : 500 });
  }
}
