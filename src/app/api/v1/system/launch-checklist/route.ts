import { NextResponse } from "next/server";
import { getLaunchChecklist } from "@/lib/system/launch-checklist";

export async function GET() {
  try {
    return NextResponse.json({ data: await getLaunchChecklist() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
