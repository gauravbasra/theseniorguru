import { NextResponse } from "next/server";
import { getImportAdapterReadiness } from "@/lib/aggregation/import-adapters";

export async function GET() {
  try {
    return NextResponse.json({ data: await getImportAdapterReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
