import { NextResponse } from "next/server";
import { getWebhookSigningGuide } from "@/lib/openapi/platform";

export async function GET() {
  return NextResponse.json({ data: getWebhookSigningGuide() });
}
