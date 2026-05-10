import { NextResponse } from "next/server";
import { getAdPlacement } from "@/lib/ads/ads";

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await context.params;
    return NextResponse.json({ data: await getAdPlacement(key) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

