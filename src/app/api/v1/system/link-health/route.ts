import { NextResponse } from "next/server";
import { browserApiNotice, isBrowserNavigation } from "@/lib/api/browser-guard";
import { getLinkHealthSummary } from "@/lib/system/link-health";

export async function GET(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  const summary = getLinkHealthSummary();
  return NextResponse.json({ data: summary }, { status: summary.status === "passed" ? 200 : 500 });
}
