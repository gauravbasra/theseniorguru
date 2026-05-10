import { browserApiNotice, isBrowserNavigation } from "@/lib/api/browser-guard";
import { getOpenApiCatalog } from "@/lib/openapi/catalog";

export function GET(request: Request) {
  if (isBrowserNavigation(request)) {
    return browserApiNotice();
  }

  return new Response(JSON.stringify(getOpenApiCatalog()), {
    headers: {
      "content-type": "application/json"
    }
  });
}
