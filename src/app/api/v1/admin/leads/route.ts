import { NextResponse } from "next/server";
import { listLeadQueue, updateLeadStatus } from "@/lib/leads";

export async function GET() {
  try {
    return NextResponse.json({ data: await listLeadQueue() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();

    if (!body.leadType || !body.id || !body.status) {
      return NextResponse.json({ error: "leadType, id, and status are required" }, { status: 422 });
    }

    const lead = await updateLeadStatus({
      leadType: body.leadType,
      id: body.id,
      status: body.status
    });

    return NextResponse.json({ data: lead });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message === "Lead not found" ? 404 : 500 });
  }
}
