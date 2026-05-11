import { NextResponse } from "next/server";
import { revokeApiKey } from "@/lib/openapi/platform";

export async function POST(request: Request, context: { params: Promise<{ id: string; keyId: string }> }) {
  try {
    const { id, keyId } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await revokeApiKey({
        apiClientId: id,
        apiKeyId: keyId,
        reason: typeof body.reason === "string" ? body.reason : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : "admin_console"
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

