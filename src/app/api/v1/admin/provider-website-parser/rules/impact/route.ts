import { NextResponse } from "next/server";
import { compareProviderWebsiteParserRuleImpact } from "@/lib/aggregation/provider-website-parser";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await compareProviderWebsiteParserRuleImpact({
        dataSourceId: typeof body.dataSourceId === "string" ? body.dataSourceId : undefined,
        crawlJobId: typeof body.crawlJobId === "string" ? body.crawlJobId : undefined,
        dryRun: body.dryRun !== false,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        reason: typeof body.reason === "string" ? body.reason : undefined,
        minConfidence: typeof body.minConfidence === "number" ? body.minConfidence : undefined,
        minContentCharacters: typeof body.minContentCharacters === "number" ? body.minContentCharacters : undefined,
        serviceKeywords: Array.isArray(body.serviceKeywords) ? body.serviceKeywords.map(String) : undefined,
        conversionKeywords: Array.isArray(body.conversionKeywords) ? body.conversionKeywords.map(String) : undefined,
        pricingKeywords: Array.isArray(body.pricingKeywords) ? body.pricingKeywords.map(String) : undefined,
        approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /not found|required|requires|No completed|No staged|not approved|blocks/.test(message) ? 422 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
