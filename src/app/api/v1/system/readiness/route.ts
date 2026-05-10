import { NextResponse } from "next/server";
import { getSystemReadiness } from "@/lib/system/readiness";

export async function GET() {
  return NextResponse.json({ data: getSystemReadiness() });
}

