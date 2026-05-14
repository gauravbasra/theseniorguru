import { NextResponse } from "next/server";
import {
  getSourceAdapterManifestReadiness,
  upsertSourceAdapterManifest
} from "@/lib/aggregation/source-adapter-manifests";

export async function GET() {
  try {
    return NextResponse.json({ data: await getSourceAdapterManifestReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.dataSourceId || !body.payloadKind || !body.fileName || !body.checksumSha256 || !body.recordCount) {
      return NextResponse.json(
        { error: "dataSourceId, payloadKind, fileName, checksumSha256, and recordCount are required" },
        { status: 422 }
      );
    }

    return NextResponse.json({
      data: await upsertSourceAdapterManifest({
        dataSourceId: body.dataSourceId,
        payloadKind: body.payloadKind,
        fileName: body.fileName,
        fileUrl: typeof body.fileUrl === "string" ? body.fileUrl : undefined,
        checksumSha256: body.checksumSha256,
        recordCount: Number(body.recordCount),
        storageStatus: body.storageStatus,
        mappingStatus: body.mappingStatus,
        approvedBy: typeof body.approvedBy === "string" ? body.approvedBy : undefined,
        receivedAt: typeof body.receivedAt === "string" ? body.receivedAt : undefined
      })
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
