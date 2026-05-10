import { NextResponse } from "next/server";
import { getOpenApiCatalog } from "@/lib/openapi/catalog";

export function GET() {
  return NextResponse.json(getOpenApiCatalog());
}

