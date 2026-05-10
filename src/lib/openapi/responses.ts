import { NextResponse } from "next/server";
import type { ApiAuthenticationResult } from "@/lib/domain/open-api";

export function partnerAuthErrorResponse(result: Extract<ApiAuthenticationResult, { ok: false }>) {
  const headers = result.retryAfterSeconds ? { "retry-after": String(result.retryAfterSeconds) } : undefined;

  return NextResponse.json({ error: result.error }, { status: result.status, headers });
}
