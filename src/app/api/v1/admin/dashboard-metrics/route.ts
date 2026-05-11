import { NextResponse } from "next/server";
import { getAdminDashboardMetrics } from "@/lib/admin/dashboard-metrics";

export async function GET() {
  try {
    return NextResponse.json({ data: await getAdminDashboardMetrics() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
