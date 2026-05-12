import { NextResponse } from "next/server";
import { getSupabaseMigrationBundle } from "@/lib/system/supabase-migration-bundle";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeSql = searchParams.get("includeSql") === "true";

    return NextResponse.json({
      data: getSupabaseMigrationBundle({ includeSql })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
