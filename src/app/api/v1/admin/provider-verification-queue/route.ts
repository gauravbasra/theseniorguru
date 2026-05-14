import { NextResponse } from "next/server";
import { getProviderVerificationQueue } from "@/lib/claims/verification-queue";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProviderVerificationQueue() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
