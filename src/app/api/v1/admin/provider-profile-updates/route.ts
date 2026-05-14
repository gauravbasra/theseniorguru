import { NextResponse } from "next/server";
import { getProviderProfileUpdateQueue } from "@/lib/providers/profile-updates";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProviderProfileUpdateQueue() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
