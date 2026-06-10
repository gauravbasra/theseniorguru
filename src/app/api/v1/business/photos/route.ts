import { NextResponse } from "next/server";
import { businessAccountIdFromRequest, createBusinessPhoto, getBusinessPortalDashboard } from "@/lib/business-portal";

export async function GET(request: Request) {
  try {
    const dashboard = await getBusinessPortalDashboard(businessAccountIdFromRequest(request));
    return NextResponse.json({ data: dashboard.photos });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.businessProfileId || !body.storageUrl) {
      return NextResponse.json({ error: "businessProfileId and storageUrl are required" }, { status: 422 });
    }

    const photo = await createBusinessPhoto(body, businessAccountIdFromRequest(request));
    return NextResponse.json({ data: photo });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
