import { NextResponse } from "next/server";
import { sendProviderVerificationAttempt } from "@/lib/claims/provider-verification";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await sendProviderVerificationAttempt({
        attemptId: id,
        channel: body.channel,
        target: body.target,
        messageTemplate: body.messageTemplate,
        actorId: body.actorId
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
