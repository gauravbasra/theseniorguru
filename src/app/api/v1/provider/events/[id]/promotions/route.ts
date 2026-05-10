import { NextResponse } from "next/server";
import { createEventPromotion, listEventPromotions } from "@/lib/events/event-promotions";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await listEventPromotions(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    return NextResponse.json(
      {
        data: await createEventPromotion({
          eventId: id,
          placementKey: body.placementKey,
          budgetCents: body.budgetCents,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          disclosureLabel: body.disclosureLabel,
          activate: body.activate,
          actorId: body.actorId
        })
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

