import { NextResponse } from "next/server";
import { listProviders } from "@/lib/providers";

export async function GET() {
  const providers = await listProviders();

  return NextResponse.json({
    data: providers,
    meta: {
      source: "provider-inventory-service",
      count: providers.length
    }
  });
}
