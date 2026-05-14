import { NextResponse } from "next/server";
import { getPartnerSandboxOnboardingChecklist } from "@/lib/openapi/developer-docs";

export async function GET() {
  return NextResponse.json({ data: getPartnerSandboxOnboardingChecklist() });
}
