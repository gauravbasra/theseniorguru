import { NextResponse } from "next/server";
import { createEventRsvp } from "@/lib/events/events";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.attendeeName || !body.attendeeEmail) {
      return NextResponse.json({ error: "attendeeName and attendeeEmail are required" }, { status: 422 });
    }

    const rsvp = await createEventRsvp({
      eventId: id,
      attendeeName: body.attendeeName,
      attendeeEmail: body.attendeeEmail,
      attendeePhone: body.attendeePhone,
      partySize: body.partySize,
      consentPayload: body.consentPayload
    });

    return NextResponse.json({ data: rsvp }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Event not found" ? 404 : 500 });
  }
}

