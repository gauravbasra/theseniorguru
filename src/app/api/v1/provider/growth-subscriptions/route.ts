import { NextResponse } from "next/server";
import {
  createGrowthSubscription,
  listProviderFeatureEntitlements,
  listProviderGrowthSubscriptions
} from "@/lib/billing/growth-subscriptions";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    const [subscriptions, entitlements] = await Promise.all([
      listProviderGrowthSubscriptions(providerId),
      listProviderFeatureEntitlements(providerId)
    ]);

    return NextResponse.json({ data: { subscriptions, entitlements } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createGrowthSubscription(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

