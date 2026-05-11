import { NextResponse } from "next/server";
import { getSupabaseMigrationPlan } from "@/lib/system/supabase-schema";

export async function GET() {
  try {
    return NextResponse.json({ data: await getSupabaseMigrationPlan() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
