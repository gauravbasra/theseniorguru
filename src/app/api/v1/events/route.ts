import { NextResponse } from "next/server";
import { listEvents } from "@/lib/events/events";

export async function GET() {
  try {
    return NextResponse.json({ data: await listEvents() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

