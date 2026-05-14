import { NextResponse } from "next/server";
import { getWebhookSdkPackagePlan } from "@/lib/openapi/developer-docs";

export async function GET() {
  return NextResponse.json({ data: getWebhookSdkPackagePlan() });
}
