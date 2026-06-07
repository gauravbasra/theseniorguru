import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/auth/admin-session";

const protectedPrefixes = [
  "/admin",
  "/business",
  "/provider",
  "/workbench",
  "/api/v1/admin",
  "/api/v1/business",
  "/api/v1/provider",
  "/api/v1/system",
  "/api/v1/openapi"
];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isApiPath(pathname: string) {
  return pathname.startsWith("/api/");
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  const session = await getAdminSessionFromRequest(request);

  if (session) {
    return NextResponse.next();
  }

  if (isApiPath(pathname)) {
    return NextResponse.json(
      {
        error: "Admin login required",
        loginUrl: "/login"
      },
      { status: 401 }
    );
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${search}`);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/business/:path*",
    "/provider/:path*",
    "/workbench/:path*",
    "/api/v1/admin/:path*",
    "/api/v1/business/:path*",
    "/api/v1/provider/:path*",
    "/api/v1/system/:path*",
    "/api/v1/openapi"
  ]
};
