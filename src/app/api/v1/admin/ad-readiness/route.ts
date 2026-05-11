import { NextResponse } from "next/server";
import { getAdReadinessSummary } from "@/lib/ads/ads";

export async function GET() {
  try {
    return NextResponse.json({ data: await getAdReadinessSummary() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
