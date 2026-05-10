import { NextResponse } from "next/server";

export function isBrowserNavigation(request: Request) {
  const accept = request.headers.get("accept") ?? "";
  return accept.includes("text/html") && !accept.includes("application/json");
}

export function browserApiNotice() {
  return new NextResponse("This is an internal API endpoint for application code.", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8"
    }
  });
}
