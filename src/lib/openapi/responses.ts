import { NextResponse } from "next/server";
import type { ApiAuthenticationResult } from "@/lib/domain/open-api";

export function partnerAuthErrorResponse(result: Extract<ApiAuthenticationResult, { ok: false }>) {
  const headers: Record<string, string> = {
    "x-senior-guru-api-status": result.retryAfterSeconds ? "rate_limited" : "blocked"
  };

  if (result.retryAfterSeconds) {
    headers["retry-after"] = String(result.retryAfterSeconds);
  }

  return NextResponse.json({ error: result.error }, { status: result.status, headers });
}

export function partnerSuccessHeaders(result: Extract<ApiAuthenticationResult, { ok: true }>) {
  return {
    "x-senior-guru-api-client": result.client.id,
    "x-senior-guru-api-key": result.apiKeyId ?? "",
    "x-senior-guru-sandbox": String(result.client.sandboxMode),
    "x-ratelimit-limit": String(result.rateLimit.limit),
    "x-ratelimit-window": String(result.rateLimit.windowSeconds)
  };
}
