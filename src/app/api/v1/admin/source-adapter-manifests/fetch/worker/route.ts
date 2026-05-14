import { NextResponse } from "next/server";
import { runSourceAdapterManifestFetchWorker } from "@/lib/aggregation/source-adapter-object-fetch";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await runSourceAdapterManifestFetchWorker({
        dryRun: body.dryRun !== false,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        maxManifests: typeof body.maxManifests === "number" ? body.maxManifests : undefined,
        maxBytes: typeof body.maxBytes === "number" ? body.maxBytes : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
