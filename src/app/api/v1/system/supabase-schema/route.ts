import { NextResponse } from "next/server";
import { getSupabaseSchemaReadiness } from "@/lib/system/supabase-schema";

export async function GET() {
  try {
    return NextResponse.json({ data: await getSupabaseSchemaReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
