import { NextResponse } from "next/server";
import { getProviderWebsiteParserRuleReadiness } from "@/lib/aggregation/provider-website-parser";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProviderWebsiteParserRuleReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
