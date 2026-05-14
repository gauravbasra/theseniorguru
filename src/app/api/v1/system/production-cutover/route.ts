import { NextResponse } from "next/server";
import { getProductionCutoverReadiness } from "@/lib/system/production-cutover";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProductionCutoverReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
