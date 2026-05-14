import { NextResponse } from "next/server";
import { confirmProviderVerificationCode } from "@/lib/claims/provider-verification";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.code || typeof body.code !== "string") {
      return NextResponse.json({ error: "code is required" }, { status: 422 });
    }

    const attempt = await confirmProviderVerificationCode({
      attemptId: id,
      code: body.code,
      actorId: body.actorId
    });

    return NextResponse.json({ data: attempt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message === "Provider verification attempt not found"
        ? 404
        : message.includes("invalid")
          ? 422
          : message.includes("expired") || message.includes("limit exceeded") || message.includes("already completed")
            ? 409
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
