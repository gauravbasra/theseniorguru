import { NextResponse } from "next/server";
import { getAcquisitionHealth } from "@/lib/aggregation/acquisition-health";
import { browserApiNotice, isBrowserNavigation } from "@/lib/api/browser-guard";

export async function GET(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  try {
    return NextResponse.json({ data: await getAcquisitionHealth() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
