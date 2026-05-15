import { NextResponse } from "next/server";
import { getProductionOriginDiagnostics } from "@/lib/system/production-origin-diagnostics";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const data = await getProductionOriginDiagnostics({
      targetUrl: searchParams.get("targetUrl") ?? undefined
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
