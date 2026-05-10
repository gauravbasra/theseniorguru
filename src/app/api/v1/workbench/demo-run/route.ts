import { NextResponse } from "next/server";
import { runFounderWorkbenchDemo } from "@/lib/workbench/demo-run";

export async function POST() {
  try {
    return NextResponse.json({ data: await runFounderWorkbenchDemo() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

