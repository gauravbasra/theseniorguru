import { NextResponse } from "next/server";
import { runCurrentSiteInventoryImport } from "@/lib/aggregation/current-site-inventory";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await runCurrentSiteInventoryImport({
      dryRun: body.dryRun ?? true,
      actorId: body.actorId,
      limit: body.limit
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
