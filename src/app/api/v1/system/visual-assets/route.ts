import { NextResponse } from "next/server";
import { browserApiNotice, isBrowserNavigation } from "@/lib/api/browser-guard";
import { getVisualAssetReadiness } from "@/lib/system/visual-assets";

export async function GET(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  const { searchParams } = new URL(request.url);
  const audience = searchParams.get("audience") ?? undefined;
  const surface = searchParams.get("surface") ?? undefined;
  const allowedAudiences = ["families", "seniors", "operators"];
  const allowedSurfaces = [
    "homepage",
    "family_discovery",
    "provider_growth",
    "newsroom",
    "local_events",
    "trust_safety",
    "seo_landing"
  ];

  if (audience && !allowedAudiences.includes(audience)) {
    return NextResponse.json({ error: "Audience must be families, seniors, or operators." }, { status: 422 });
  }

  if (surface && !allowedSurfaces.includes(surface)) {
    return NextResponse.json({ error: "Surface is not supported for visual asset readiness." }, { status: 422 });
  }

  const summary = getVisualAssetReadiness(
    audience as "families" | "seniors" | "operators" | undefined,
    surface as
      | "homepage"
      | "family_discovery"
      | "provider_growth"
      | "newsroom"
      | "local_events"
      | "trust_safety"
      | "seo_landing"
      | undefined
  );
  return NextResponse.json({ data: summary }, { status: summary.status === "passed" ? 200 : 500 });
}
