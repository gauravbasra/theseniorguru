import { NextResponse, type NextRequest } from "next/server";
import { getAdminAuthConfig, getAdminSessionFromRequest } from "@/lib/auth/admin-session";

export async function GET(request: NextRequest) {
  const session = await getAdminSessionFromRequest(request);

  return NextResponse.json({
    data: {
      authenticated: Boolean(session),
      role: session?.role ?? null,
      expiresAt: session ? new Date(session.exp * 1000).toISOString() : null,
      authConfigured: getAdminAuthConfig().configured
    }
  });
}

