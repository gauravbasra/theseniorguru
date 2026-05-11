import { NextResponse } from "next/server";
import { getPersistenceStatus } from "@/lib/system/persistence";

export async function GET() {
  return NextResponse.json({ data: getPersistenceStatus() });
}
