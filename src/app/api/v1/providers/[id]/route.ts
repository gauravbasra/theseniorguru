import { NextResponse } from "next/server";
import { getProviderById } from "@/lib/providers";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const provider = getProviderById(id);

  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  return NextResponse.json({ data: provider });
}
