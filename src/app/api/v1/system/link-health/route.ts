import { NextResponse } from "next/server";
import { getLinkHealthSummary } from "@/lib/system/link-health";

export async function GET() {
  const summary = getLinkHealthSummary();
  return NextResponse.json({ data: summary }, { status: summary.status === "passed" ? 200 : 500 });
}
