import { NextResponse } from "next/server";
import { businessAccountIdFromRequest, createBusinessService, getBusinessPortalDashboard } from "@/lib/business-portal";

export async function GET(request: Request) {
  try {
    const dashboard = await getBusinessPortalDashboard(businessAccountIdFromRequest(request));
    return NextResponse.json({ data: dashboard.services });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const required = ["businessProfileId", "category", "serviceName"];
    const missing = required.filter((key) => !body[key]);

    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 422 });
    }

    const service = await createBusinessService(body, businessAccountIdFromRequest(request));
    return NextResponse.json({ data: service });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("Free package") ? 402 : 500 });
  }
}
