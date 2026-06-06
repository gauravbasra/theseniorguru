import { NextResponse, type NextRequest } from "next/server";
import { getAdminSessionFromRequest } from "@/lib/auth/admin-session";

const protectedPrefixes = [
  "/admin",
  "/provider",
  "/workbench",
  "/api/v1/admin",
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

function isPublicAssetPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/assets/")
  );
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isPublicAssetPath(pathname)) {
    return NextResponse.next();
  }

  if (!isApiPath(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl, 307);
  }

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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|assets).*)"
  ]
};
