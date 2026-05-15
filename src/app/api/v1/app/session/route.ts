import { NextResponse, type NextRequest } from "next/server";
import {
  appSessionCookieName,
  createAppSession,
  getAppSessionConfig,
  getAppSessionFromRequest
} from "@/lib/mobile/session";

export async function GET(request: NextRequest) {
  const session = await getAppSessionFromRequest(request);

  return NextResponse.json({
    data: {
      authenticated: Boolean(session),
      userKey: session?.sub ?? null,
      role: session?.role ?? null,
      expiresAt: session ? new Date(session.exp * 1000).toISOString() : null,
      config: getAppSessionConfig()
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await createAppSession({
      userKey: body.userKey,
      displayName: body.displayName,
      email: body.email,
      role: body.role
    });
    const response = NextResponse.json({ data: session }, { status: 201 });

    response.cookies.set(appSessionCookieName, session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: session.sessionTtlSeconds
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
