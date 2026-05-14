import { NextResponse } from "next/server";
import { authenticatePartnerApiRequest, verifyWebhookSignature } from "@/lib/openapi/platform";
import { partnerAuthErrorResponse, partnerSuccessHeaders } from "@/lib/openapi/responses";

export async function POST(request: Request) {
  try {
    const auth = await authenticatePartnerApiRequest(request, "webhooks:write", {
      eventType: "partner.webhook_signature.verify",
      subjectType: "webhook_signature"
    });

    if (!auth.ok) {
      return partnerAuthErrorResponse(auth);
    }

    const body = await request.json().catch(() => ({}));

    if (!body.subscriptionId || !body.signature || !body.payload) {
      return NextResponse.json({ error: "subscriptionId, signature, and payload are required" }, { status: 422 });
    }

    const payload = typeof body.payload === "string" ? body.payload : JSON.stringify(body.payload);

    return NextResponse.json(
      {
        data: await verifyWebhookSignature({
          apiClientId: auth.client.id,
          subscriptionId: String(body.subscriptionId),
          signature: String(body.signature),
          payload,
          timestamp: Number.isFinite(Number(body.timestamp)) ? Number(body.timestamp) : undefined,
          toleranceSeconds: Number.isFinite(Number(body.toleranceSeconds)) ? Number(body.toleranceSeconds) : undefined
        })
      },
      { headers: partnerSuccessHeaders(auth) }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
