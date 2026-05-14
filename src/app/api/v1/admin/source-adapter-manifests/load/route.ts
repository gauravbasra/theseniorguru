import { NextResponse } from "next/server";
import { loadSourceAdapterManifestPayload } from "@/lib/aggregation/source-adapter-payload-loader";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.manifestId || !Array.isArray(body.records) || !body.records.length) {
      return NextResponse.json({ error: "manifestId and records are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await loadSourceAdapterManifestPayload({
        manifestId: body.manifestId,
        records: body.records,
        dryRun: body.dryRun !== false,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        batchName: typeof body.batchName === "string" ? body.batchName : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
