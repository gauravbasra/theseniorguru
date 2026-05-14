import { NextResponse } from "next/server";
import { replaceProviderWebsiteParserRuleOverride } from "@/lib/aggregation/provider-website-parser";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false;

    if (!dryRun && !body.dataSourceId) {
      return NextResponse.json({ error: "dataSourceId is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await replaceProviderWebsiteParserRuleOverride({
        dataSourceId: typeof body.dataSourceId === "string" ? body.dataSourceId : "",
        dryRun,
        minConfidence: typeof body.minConfidence === "number" ? body.minConfidence : undefined,
        minContentCharacters: typeof body.minContentCharacters === "number" ? body.minContentCharacters : undefined,
        serviceKeywords: Array.isArray(body.serviceKeywords) ? body.serviceKeywords.map(String) : undefined,
        conversionKeywords: Array.isArray(body.conversionKeywords) ? body.conversionKeywords.map(String) : undefined,
        pricingKeywords: Array.isArray(body.pricingKeywords) ? body.pricingKeywords.map(String) : undefined,
        approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined,
        reason: typeof body.reason === "string" ? body.reason : undefined
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /not found|required|requires/i.test(message) ? 422 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
