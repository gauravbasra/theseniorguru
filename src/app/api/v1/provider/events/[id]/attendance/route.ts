import { NextResponse } from "next/server";
import { recordEventAttendance } from "@/lib/events/events";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.rsvpId || !body.status) {
      return NextResponse.json({ error: "rsvpId and status are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await recordEventAttendance({
        eventId: id,
        rsvpId: body.rsvpId,
        status: body.status,
        checkedInAt: body.checkedInAt,
        attendanceSource: body.attendanceSource,
        notes: body.notes,
        actorId: body.actorId
      })
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Event not found" || message === "RSVP not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
