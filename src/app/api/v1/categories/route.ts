import { NextResponse } from "next/server";
import { listProviderCategories } from "@/lib/directory/search";

export async function GET() {
  try {
    const categories = await listProviderCategories();

    return NextResponse.json({
      data: categories,
      meta: {
        source: "provider-inventory-service",
        count: categories.length
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
