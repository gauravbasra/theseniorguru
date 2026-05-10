import { NextResponse } from "next/server";
import { submitOperatorDemoRequest } from "@/lib/leads";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.contactName || !body.organizationName) {
      return NextResponse.json({ error: "contactName and organizationName are required" }, { status: 422 });
    }

    if (body.consentToContact !== true) {
      return NextResponse.json({ error: "consentToContact must be true before demo request submission" }, { status: 422 });
    }

    const demoRequest = await submitOperatorDemoRequest({
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      organizationName: body.organizationName,
      role: body.role,
      communityCount: body.communityCount,
      occupancyChallenge: body.occupancyChallenge,
      requestedProduct: body.requestedProduct,
      consentToContact: body.consentToContact
    });

    return NextResponse.json(
      { data: demoRequest },
      { status: demoRequest.status === "blocked_by_policy" ? 403 : 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
