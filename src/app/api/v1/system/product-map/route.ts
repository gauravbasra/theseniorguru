import { NextResponse } from "next/server";
import { getProductMap } from "@/lib/system/product-map";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProductMap() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
