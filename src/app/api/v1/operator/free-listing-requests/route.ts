import { NextResponse } from "next/server";
import { submitFreeListingRequest } from "@/lib/leads";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.communityName || !body.contactName) {
      return NextResponse.json({ error: "communityName and contactName are required" }, { status: 422 });
    }

    if (body.consentToContact !== true) {
      return NextResponse.json(
        { error: "consentToContact must be true before free listing request submission" },
        { status: 422 }
      );
    }

    const requestRecord = await submitFreeListingRequest({
      communityName: body.communityName,
      contactName: body.contactName,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      city: body.city,
      state: body.state,
      websiteUrl: body.websiteUrl,
      careTypes: Array.isArray(body.careTypes) ? body.careTypes.map(String) : undefined,
      message: body.message,
      consentToContact: body.consentToContact
    });

    return NextResponse.json(
      { data: requestRecord },
      { status: requestRecord.status === "blocked_by_policy" ? 403 : 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
