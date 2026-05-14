import { NextResponse } from "next/server";
import { scheduleNewsletterEdition } from "@/lib/newsroom/newsroom";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (!body.scheduledFor) {
      return NextResponse.json({ error: "scheduledFor is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await scheduleNewsletterEdition(id, {
        actorId: body.actorId,
        notes: body.notes,
        scheduledFor: body.scheduledFor
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
