import { NextResponse, type NextRequest } from "next/server";
import {
  adminSessionCookieName,
  createAdminSessionToken,
  getAdminAuthConfig,
  isAdminAccessCodeValid
} from "@/lib/auth/admin-session";

async function readAccessCode(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);
    return typeof body?.accessCode === "string" ? body.accessCode : "";
  }

  const form = await request.formData().catch(() => null);
  const accessCode = form?.get("accessCode");

  return typeof accessCode === "string" ? accessCode : "";
}

export async function POST(request: NextRequest) {
  const accessCode = await readAccessCode(request);

  if (!isAdminAccessCodeValid(accessCode)) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  }

  const sessionToken = await createAdminSessionToken();
  const { sessionTtlSeconds } = getAdminAuthConfig();
  const nextPath = request.nextUrl.searchParams.get("next") || "/admin";
  const response = NextResponse.json({ data: { ok: true, nextPath } });

  response.cookies.set(adminSessionCookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: sessionTtlSeconds
  });

  return response;
}

