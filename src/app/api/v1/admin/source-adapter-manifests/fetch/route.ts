import { NextResponse } from "next/server";
import { runSourceAdapterManifestFetch } from "@/lib/aggregation/source-adapter-object-fetch";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.manifestId) {
      return NextResponse.json({ error: "manifestId is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await runSourceAdapterManifestFetch({
        manifestId: String(body.manifestId),
        dryRun: body.dryRun !== false,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        batchName: typeof body.batchName === "string" ? body.batchName : undefined,
        maxBytes: body.maxBytes ? Number(body.maxBytes) : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
