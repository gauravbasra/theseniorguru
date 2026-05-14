import { NextResponse } from "next/server";
import { getPartnerDeveloperDocs } from "@/lib/openapi/developer-docs";

export async function GET() {
  return NextResponse.json({ data: getPartnerDeveloperDocs() });
}
