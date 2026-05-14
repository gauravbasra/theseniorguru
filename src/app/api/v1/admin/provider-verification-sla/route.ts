import { NextResponse } from "next/server";
import { getProviderVerificationSlaSummary } from "@/lib/claims/verification-queue";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProviderVerificationSlaSummary() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
