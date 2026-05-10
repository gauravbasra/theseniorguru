import { NextResponse } from "next/server";
import { checkProviderFeature } from "@/lib/billing/entitlements";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.providerId || !body.featureKey) {
      return NextResponse.json({ error: "providerId and featureKey are required" }, { status: 422 });
    }

    return NextResponse.json({ data: await checkProviderFeature(body.providerId, body.featureKey) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

