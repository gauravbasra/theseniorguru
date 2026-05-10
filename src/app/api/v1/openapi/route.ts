import { getOpenApiCatalog } from "@/lib/openapi/catalog";

export function GET() {
  return new Response(JSON.stringify(getOpenApiCatalog()), {
    headers: {
      "content-type": "application/json"
    }
  });
}
