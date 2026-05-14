import { NextResponse } from "next/server";
import { getProviderWebsiteParserRuleOverrideAuditSummary } from "@/lib/aggregation/provider-website-parser";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProviderWebsiteParserRuleOverrideAuditSummary() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
