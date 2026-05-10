import { NextResponse } from "next/server";
import { listGrowthPlans } from "@/lib/billing/growth-subscriptions";

export async function GET() {
  try {
    return NextResponse.json({ data: await listGrowthPlans() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

