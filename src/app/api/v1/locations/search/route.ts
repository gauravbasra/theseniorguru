import { NextResponse } from "next/server";
import { searchLocations } from "@/lib/directory/search";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const locations = await searchLocations({
      q: url.searchParams.get("q") ?? undefined,
      state: url.searchParams.get("state") ?? undefined,
      category: url.searchParams.get("category") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined
    });

    return NextResponse.json({
      data: locations,
      meta: {
        source: "provider-inventory-service",
        count: locations.length
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
