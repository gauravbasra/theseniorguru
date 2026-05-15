import { NextResponse } from "next/server";
import { createVoiceAssistantPreview, getVoiceAssistantReadiness } from "@/lib/campaigns/voice-assistant";

const allowedProviders = new Set(["manual_export", "internal_notification_queue", "twilio", "retell", "elevenlabs"]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId") ?? undefined;

    return NextResponse.json({ data: await getVoiceAssistantReadiness(providerId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    if (body.deliveryProvider && !allowedProviders.has(body.deliveryProvider)) {
      return NextResponse.json(
        { error: "deliveryProvider must be manual_export, internal_notification_queue, twilio, retell, or elevenlabs" },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        data: await createVoiceAssistantPreview({
          providerId: body.providerId,
          assistantName: body.assistantName,
          phoneNumber: body.phoneNumber,
          transferNumber: body.transferNumber,
          greeting: body.greeting,
          missedCallPolicy: body.missedCallPolicy,
          deliveryProvider: body.deliveryProvider,
          dryRun: body.dryRun,
          actorId: body.actorId
        })
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Provider not found" ? 404 : 500 });
  }
}
