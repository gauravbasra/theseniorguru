import { NextResponse } from "next/server";
import { runSourceAdapterWorker } from "@/lib/aggregation/source-adapter-worker";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await runSourceAdapterWorker({
        dryRun: body.dryRun !== false,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        maxAdapters: typeof body.maxAdapters === "number" ? body.maxAdapters : undefined,
        payloads: Array.isArray(body.payloads) ? body.payloads : []
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
