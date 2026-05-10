import { NextResponse } from "next/server";
import { createWebhookSubscription, listWebhookSubscriptions } from "@/lib/openapi/platform";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json({ data: await listWebhookSubscriptions(searchParams.get("apiClientId") ?? undefined) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.apiClientId || !body.targetUrl || !Array.isArray(body.eventTypes)) {
      return NextResponse.json({ error: "apiClientId, targetUrl, and eventTypes are required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createWebhookSubscription(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
