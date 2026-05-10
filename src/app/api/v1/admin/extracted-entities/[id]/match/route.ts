import { NextResponse } from "next/server";
import { scoreEntityMatchCandidates } from "@/lib/aggregation/entity-matching";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await scoreEntityMatchCandidates(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

