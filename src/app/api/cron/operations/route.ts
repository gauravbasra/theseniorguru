import { NextResponse } from "next/server";
import { expireProviderVerificationAttempts } from "@/lib/claims/provider-verification";
import { getAppEnv } from "@/lib/env";
import { processWebhookDeliveries } from "@/lib/openapi/platform";

export const dynamic = "force-dynamic";

function getExpectedCronSecret() {
  const env = getAppEnv();

  if (env.cronSecret) {
    return env.cronSecret;
  }

  return process.env.NODE_ENV === "production" ? null : "local-cron-secret";
}

function isAuthorized(request: Request) {
  const expected = getExpectedCronSecret();

  if (!expected) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request" }, { status: 401 });
  }

  try {
    const [verificationExpiry, webhookDelivery] = await Promise.all([
      expireProviderVerificationAttempts({
        actorId: "cron:operations",
        limit: 50
      }),
      processWebhookDeliveries({
        limit: 25
      })
    ]);

    return NextResponse.json({
      data: {
        ranAt: new Date().toISOString(),
        verificationExpiry,
        webhookDelivery
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
