import { NextResponse } from "next/server";
import { getApiUsageAnalytics } from "@/lib/openapi/platform";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const windowDays = Number(searchParams.get("windowDays") ?? 30);

    return NextResponse.json({
      data: await getApiUsageAnalytics({
        apiClientId: searchParams.get("apiClientId") ?? undefined,
        windowDays: Number.isFinite(windowDays) ? windowDays : 30
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
