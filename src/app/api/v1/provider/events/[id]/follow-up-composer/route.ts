import { NextResponse } from "next/server";
import { composeProviderEventFollowup } from "@/lib/events/event-automation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await composeProviderEventFollowup({
        eventId: id,
        tone: body.tone,
        callToAction: body.callToAction,
        actorId: typeof body.actorId === "string" ? body.actorId : "provider:event-followup-composer"
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Event not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
