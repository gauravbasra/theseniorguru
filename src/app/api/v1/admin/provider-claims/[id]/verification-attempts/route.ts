import { NextResponse } from "next/server";
import {
  createProviderVerificationAttempt,
  listProviderVerificationAttempts
} from "@/lib/claims/provider-verification";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ data: await listProviderVerificationAttempts(id) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.method) {
      return NextResponse.json({ error: "method is required" }, { status: 422 });
    }

    return NextResponse.json(
      {
        data: await createProviderVerificationAttempt({
          claimId: id,
          method: body.method,
          target: body.target,
          attemptPayload: body.attemptPayload,
          expiresAt: body.expiresAt,
          actorId: body.actorId
        })
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

