import { NextResponse } from "next/server";
import { submitProviderContactIntent } from "@/lib/providers/contact";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.requesterName) {
      return NextResponse.json({ error: "requesterName is required" }, { status: 422 });
    }

    if (body.consentToContact !== true) {
      return NextResponse.json({ error: "consentToContact must be true before contact submission" }, { status: 422 });
    }

    const contact = await submitProviderContactIntent({
      providerId: id,
      requesterName: body.requesterName,
      requesterEmail: body.requesterEmail,
      requesterPhone: body.requesterPhone,
      relationship: body.relationship,
      payingWith: body.payingWith,
      message: body.message,
      consentToContact: body.consentToContact
    });

    return NextResponse.json({ data: contact }, { status: contact.status === "blocked_by_policy" ? 403 : 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Provider not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
