import { NextResponse } from "next/server";
import { submitProviderClaim } from "@/lib/claims/provider-claims";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.claimantName || !body.claimantEmail) {
      return NextResponse.json({ error: "claimantName and claimantEmail are required" }, { status: 422 });
    }

    const claim = await submitProviderClaim({
      providerId: id,
      claimantName: body.claimantName,
      claimantEmail: body.claimantEmail,
      claimantPhone: body.claimantPhone,
      claimantRole: body.claimantRole,
      businessDomain: body.businessDomain
    });

    return NextResponse.json({ data: claim }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Provider not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

