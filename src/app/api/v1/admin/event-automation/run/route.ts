import { NextResponse } from "next/server";
import { runEventReminderAutomation } from "@/lib/events/event-automation";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await runEventReminderAutomation({
        now: typeof body.now === "string" ? body.now : undefined,
        reminderWindowHours: typeof body.reminderWindowHours === "number" ? body.reminderWindowHours : undefined,
        followupWindowHours: typeof body.followupWindowHours === "number" ? body.followupWindowHours : undefined,
        deliveryProvider: typeof body.deliveryProvider === "string" ? body.deliveryProvider : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : "admin:event-automation",
        dryRun: body.dryRun !== false
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
