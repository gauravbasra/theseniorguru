import { NextResponse } from "next/server";
import {
  getProviderWebsiteParserRuleReadiness,
  upsertProviderWebsiteParserRuleOverride
} from "@/lib/aggregation/provider-website-parser";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProviderWebsiteParserRuleReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.dataSourceId) {
      return NextResponse.json({ error: "dataSourceId is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await upsertProviderWebsiteParserRuleOverride({
        dataSourceId: body.dataSourceId,
        minConfidence: typeof body.minConfidence === "number" ? body.minConfidence : undefined,
        minContentCharacters: typeof body.minContentCharacters === "number" ? body.minContentCharacters : undefined,
        serviceKeywords: Array.isArray(body.serviceKeywords) ? body.serviceKeywords.map(String) : undefined,
        conversionKeywords: Array.isArray(body.conversionKeywords) ? body.conversionKeywords.map(String) : undefined,
        pricingKeywords: Array.isArray(body.pricingKeywords) ? body.pricingKeywords.map(String) : undefined,
        status: body.status === "inactive" ? "inactive" : "active",
        approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : undefined,
        notes: typeof body.notes === "string" ? body.notes : undefined
      })
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
