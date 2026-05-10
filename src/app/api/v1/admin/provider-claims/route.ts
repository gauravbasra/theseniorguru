import { NextResponse } from "next/server";
import { listProviderClaims } from "@/lib/claims/provider-claims";

export async function GET() {
  try {
    return NextResponse.json({ data: await listProviderClaims() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

