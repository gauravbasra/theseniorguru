import { NextResponse } from "next/server";
import { getEventAnalytics } from "@/lib/events/event-analytics";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await getEventAnalytics(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

