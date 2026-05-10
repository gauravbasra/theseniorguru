import { NextResponse } from "next/server";
import { enqueueWebhookDeliveries, listWebhookDeliveries } from "@/lib/openapi/platform";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;

    return NextResponse.json({ data: await listWebhookDeliveries(status as Parameters<typeof listWebhookDeliveries>[0]) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

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
