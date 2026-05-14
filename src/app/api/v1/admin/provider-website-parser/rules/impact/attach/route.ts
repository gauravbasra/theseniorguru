import { NextResponse } from "next/server";
import { attachProviderWebsiteParserRuleImpactEvidence } from "@/lib/aggregation/provider-website-parser";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await attachProviderWebsiteParserRuleImpactEvidence({
        dataSourceId: typeof body.dataSourceId === "string" ? body.dataSourceId : undefined,
        overrideId: typeof body.overrideId === "string" ? body.overrideId : undefined,
        auditEventIds: Array.isArray(body.auditEventIds) ? body.auditEventIds.map(String) : undefined,
        dryRun: body.dryRun !== false,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        reason: typeof body.reason === "string" ? body.reason : undefined
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /not found|required|blocked|active/i.test(message) ? 422 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
