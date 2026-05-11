import { NextResponse } from "next/server";
import { getSupabaseLaunchReadiness } from "@/lib/system/supabase-launch-readiness";

export async function GET() {
  try {
    return NextResponse.json({ data: await getSupabaseLaunchReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
