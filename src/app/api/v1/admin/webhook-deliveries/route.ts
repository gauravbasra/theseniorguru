import { NextResponse } from "next/server";
import { enqueueWebhookDeliveries } from "@/lib/openapi/platform";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.eventType || !body.payload) {
      return NextResponse.json({ error: "eventType and payload are required" }, { status: 422 });
    }

    return NextResponse.json(
      {
        data: await enqueueWebhookDeliveries({
          eventType: body.eventType,
          subjectId: body.subjectId,
          payload: body.payload
        })
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
