import { NextResponse } from "next/server";
import type { ApiAuthenticationResult } from "@/lib/domain/open-api";

export const partnerResponseEnvelopeVersion = "2026-05-14.partner.v1";

export function partnerResponseEnvelopeMeta() {
  return {
    version: partnerResponseEnvelopeVersion,
    dataPath: "data",
    metaPath: "meta",
    errorPath: "error"
  };
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(Math.trunc(parsed), min), max);
}

export function partnerPaginationFromRequest(request: Request, total: number) {
  const { searchParams } = new URL(request.url);
  const page = boundedInteger(searchParams.get("page"), 1, 1, 10_000);
  const pageSize = boundedInteger(searchParams.get("pageSize"), 50, 1, 100);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const normalizedPage = Math.min(page, pageCount);
  const offset = (normalizedPage - 1) * pageSize;

  return {
    page: normalizedPage,
    pageSize,
    total,
    pageCount,
    hasNextPage: normalizedPage < pageCount,
    hasPreviousPage: normalizedPage > 1,
    nextPage: normalizedPage < pageCount ? normalizedPage + 1 : null,
    previousPage: normalizedPage > 1 ? normalizedPage - 1 : null,
    offset
  };
}

export function applyPartnerPagination<T>(items: T[], pagination: ReturnType<typeof partnerPaginationFromRequest>) {
  return items.slice(pagination.offset, pagination.offset + pagination.pageSize);
}

export function partnerAuthErrorResponse(result: Extract<ApiAuthenticationResult, { ok: false }>) {
  const headers: Record<string, string> = {
    "x-senior-guru-api-status": result.retryAfterSeconds ? "rate_limited" : "blocked",
    "x-senior-guru-envelope-version": partnerResponseEnvelopeVersion
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
    "x-senior-guru-envelope-version": partnerResponseEnvelopeVersion,
    "x-ratelimit-limit": String(result.rateLimit.limit),
    "x-ratelimit-window": String(result.rateLimit.windowSeconds)
  };
}
