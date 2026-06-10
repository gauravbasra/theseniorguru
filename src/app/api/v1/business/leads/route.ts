import { NextResponse } from "next/server";
import { businessAccountIdFromRequest, createBusinessLead, getBusinessPortalDashboard, updateBusinessLeadStatus } from "@/lib/business-portal";

export async function GET(request: Request) {
  try {
    const dashboard = await getBusinessPortalDashboard(businessAccountIdFromRequest(request));
    return NextResponse.json({ data: dashboard.leads });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const required = ["businessProfileId", "requestType", "requestTitle"];
    const missing = required.filter((key) => !body[key]);

    if (missing.length) {
      return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 422 });
    }

    const lead = await createBusinessLead(body);
    return NextResponse.json({ data: lead });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body.leadId || !body.status) {
      return NextResponse.json({ error: "leadId and status are required" }, { status: 422 });
    }

    const lead = await updateBusinessLeadStatus(body, businessAccountIdFromRequest(request));
    return NextResponse.json({ data: lead });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
