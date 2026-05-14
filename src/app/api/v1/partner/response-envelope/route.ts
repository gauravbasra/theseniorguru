import { NextResponse } from "next/server";
import { getPartnerResponseEnvelopeContract } from "@/lib/openapi/developer-docs";

export async function GET() {
  return NextResponse.json({ data: getPartnerResponseEnvelopeContract() });
}
