import { browserApiNotice, isBrowserNavigation } from "@/lib/api/browser-guard";
import { getOpenApiCatalog } from "@/lib/openapi/catalog";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  const body = JSON.stringify(getOpenApiCatalog());

  return new Response(body, {
    headers: {
      "content-length": String(Buffer.byteLength(body)),
      "content-type": "application/json; charset=utf-8"
    }
  });
}
