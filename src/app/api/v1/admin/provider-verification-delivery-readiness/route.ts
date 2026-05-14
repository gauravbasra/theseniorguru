import { NextResponse } from "next/server";
import { getProviderVerificationDeliveryReadiness } from "@/lib/claims/provider-verification";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProviderVerificationDeliveryReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
