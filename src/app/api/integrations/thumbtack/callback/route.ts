import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    console.error("[Thumbtack callback] OAuth error:", error, searchParams.get("error_description"));
    return NextResponse.redirect(new URL("/?thumbtack=error", request.url));
  }

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  // TODO: Exchange code for access token using Thumbtack OAuth token endpoint
  // Store the token securely (e.g. in Supabase) associated with the state/user
  console.log("[Thumbtack callback] Received code, state:", state);

  return NextResponse.redirect(new URL("/?thumbtack=connected", request.url));
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // TODO: Verify Thumbtack webhook signature before processing
  console.log("[Thumbtack callback] Webhook received:", JSON.stringify(body));

  return NextResponse.json({ received: true });
}
