import { NextResponse } from "next/server";
import { issueProviderVerificationCode } from "@/lib/claims/provider-verification";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const delivery = await issueProviderVerificationCode({
      attemptId: id,
      channel: body.channel,
      target: body.target,
      actorId: body.actorId
    });

    return NextResponse.json({ data: delivery });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Provider verification attempt not found"
        ? 404
        : message.includes("already completed") || message.includes("has expired")
          ? 409
          : message.includes("can only")
            ? 422
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
