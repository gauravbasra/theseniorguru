import { NextResponse } from "next/server";
import { getSuperadminBusinessPortalOverview } from "@/lib/business-portal";

export async function GET() {
  try {
    return NextResponse.json({ data: await getSuperadminBusinessPortalOverview() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
