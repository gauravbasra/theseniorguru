import { NextResponse } from "next/server";
import { getSourceAdapterStorageReadiness } from "@/lib/aggregation/source-adapter-storage-readiness";

export async function GET() {
  try {
    return NextResponse.json({ data: await getSourceAdapterStorageReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
