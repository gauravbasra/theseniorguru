import { NextResponse } from "next/server";
import { getDataSourceApprovalQueue } from "@/lib/data-sources";

export async function GET() {
  try {
    return NextResponse.json({ data: await getDataSourceApprovalQueue() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
