import { NextResponse } from "next/server";
import {
  getExternalReviewIntegrationSummary,
  upsertExternalReviewIntegration
} from "@/lib/reviews/external-integrations";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await getExternalReviewIntegrationSummary(providerId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Provider not found" ? 404 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.providerId || !body.source) {
      return NextResponse.json({ error: "providerId and source are required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await upsertExternalReviewIntegration({
        providerId: body.providerId,
        source: body.source,
        credentialReference: body.credentialReference,
        syncMode: body.syncMode,
        enabled: body.enabled,
        payload: body.payload,
        actorId: body.actorId
      })
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Provider not found" ? 404 : message === "Unsupported external review source" ? 422 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
