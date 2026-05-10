import { NextResponse } from "next/server";
import { listProviders } from "@/lib/providers";

export function GET() {
  return NextResponse.json({
    data: listProviders(),
    meta: {
      source: "provider-inventory-service",
      count: listProviders().length
    }
  });
}

