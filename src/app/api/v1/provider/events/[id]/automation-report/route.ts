import { NextResponse } from "next/server";
import { getEventAutomationReport } from "@/lib/events/event-automation";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    return NextResponse.json({ data: await getEventAutomationReport(id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Event not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
