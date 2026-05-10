import { NextResponse } from "next/server";
import { createEvent } from "@/lib/events/events";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.title || !body.eventType || !body.startsAt || !body.endsAt) {
      return NextResponse.json({ error: "title, eventType, startsAt, and endsAt are required" }, { status: 422 });
    }

    const event = await createEvent({
      providerId: body.providerId,
      title: body.title,
      description: body.description,
      eventType: body.eventType,
      startsAt: body.startsAt,
      endsAt: body.endsAt,
      timezone: body.timezone,
      venueName: body.venueName,
      addressLine1: body.addressLine1,
      city: body.city,
      state: body.state,
      postalCode: body.postalCode,
      capacity: body.capacity,
      isFree: body.isFree,
      registrationUrl: body.registrationUrl,
      publish: body.publish
    });

    return NextResponse.json({ data: event }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

