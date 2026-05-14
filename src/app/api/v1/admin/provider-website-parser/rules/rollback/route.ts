import { NextResponse } from "next/server";
import { rollbackProviderWebsiteParserRuleOverride } from "@/lib/aggregation/provider-website-parser";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    const dryRun = body.dryRun !== false;

    if (!dryRun && !body.dataSourceId && !body.overrideId) {
      return NextResponse.json({ error: "dataSourceId or overrideId is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await rollbackProviderWebsiteParserRuleOverride({
        dryRun,
        dataSourceId: typeof body.dataSourceId === "string" ? body.dataSourceId : undefined,
        overrideId: typeof body.overrideId === "string" ? body.overrideId : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        reason: typeof body.reason === "string" ? body.reason : undefined
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = /not found|required|already inactive/i.test(message) ? 422 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
