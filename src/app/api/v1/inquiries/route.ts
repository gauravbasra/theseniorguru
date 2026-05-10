import { NextResponse } from "next/server";
import { submitFamilyInquiry } from "@/lib/leads";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.requesterName) {
      return NextResponse.json({ error: "requesterName is required" }, { status: 422 });
    }

    if (body.consentToContact !== true) {
      return NextResponse.json({ error: "consentToContact must be true before inquiry submission" }, { status: 422 });
    }

    const inquiry = await submitFamilyInquiry({
      requesterName: body.requesterName,
      requesterEmail: body.requesterEmail,
      requesterPhone: body.requesterPhone,
      city: body.city,
      state: body.state,
      careType: body.careType,
      timeline: body.timeline,
      budget: body.budget,
      message: body.message,
      consentToContact: body.consentToContact
    });

    return NextResponse.json({ data: inquiry }, { status: inquiry.status === "blocked_by_policy" ? 403 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
