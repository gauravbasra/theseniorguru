import { NextResponse } from "next/server";
import { getDeploymentStatus } from "@/lib/system/deployment";

export async function GET() {
  return NextResponse.json({ data: getDeploymentStatus() });
}
