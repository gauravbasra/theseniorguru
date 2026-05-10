import { NextResponse } from "next/server";
import { listApiAuditEvents } from "@/lib/openapi/platform";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({ data: await listApiAuditEvents(searchParams.get("apiClientId") ?? undefined) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
