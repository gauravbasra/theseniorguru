import { NextResponse } from "next/server";
import { getProviderClaimStatusSummary } from "@/lib/claims/claim-status";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await getProviderClaimStatusSummary(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Provider claim not found" ? 404 : 500 });
  }
}
