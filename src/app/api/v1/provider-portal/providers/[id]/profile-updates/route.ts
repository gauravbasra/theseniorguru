import { NextResponse } from "next/server";
import { getProviderProfileUpdateStatus } from "@/lib/providers/profile-updates";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    return NextResponse.json({ data: await getProviderProfileUpdateStatus(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
