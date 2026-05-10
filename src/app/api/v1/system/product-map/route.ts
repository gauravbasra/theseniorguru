import { NextResponse } from "next/server";
import { browserApiNotice, isBrowserNavigation } from "@/lib/api/browser-guard";
import { getProductMap } from "@/lib/system/product-map";

export async function GET(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  try {
    return NextResponse.json({ data: await getProductMap() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
