import { NextResponse } from "next/server";
import { getPartnerApiChangelog } from "@/lib/openapi/developer-docs";

export async function GET() {
  return NextResponse.json({ data: getPartnerApiChangelog() });
}
