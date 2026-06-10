import { NextResponse } from "next/server";
import { businessAccountIdFromRequest, getBusinessPortalDashboard, upsertBusinessProfile } from "@/lib/business-portal";

export async function GET(request: Request) {
  try {
    return NextResponse.json({ data: await getBusinessPortalDashboard(businessAccountIdFromRequest(request)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const required = ["businessType", "legalName", "ownerName", "phone", "email"];
    const missing = required.filter((key) => !body[key]);

    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 422 });
    }

    const profile = await upsertBusinessProfile(body, businessAccountIdFromRequest(request));
    return NextResponse.json({ data: profile });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
