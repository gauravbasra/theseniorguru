import { NextResponse } from "next/server";
import type { PolicyOverrideStatus } from "@/lib/domain/providers";
import { createPolicyOverrideRequest, listPolicyOverrideRequests } from "@/lib/policy";

const allowedStatuses: PolicyOverrideStatus[] = ["requested", "approved", "rejected", "expired"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const limit = Number(searchParams.get("limit") ?? 100);

    if (status && !allowedStatuses.includes(status as PolicyOverrideStatus)) {
      return NextResponse.json({ error: "Unsupported policy override status filter" }, { status: 422 });
    }

    return NextResponse.json({
      data: await listPolicyOverrideRequests({
        status: status ? (status as PolicyOverrideStatus) : undefined,
        limit: Number.isFinite(limit) ? limit : 100
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.policyCheckId || typeof body.reason !== "string") {
      return NextResponse.json({ error: "policyCheckId and reason are required" }, { status: 422 });
    }

    const data = await createPolicyOverrideRequest({
      policyCheckId: String(body.policyCheckId),
      reason: body.reason,
      requestedBy: body.requestedBy ? String(body.requestedBy) : "admin",
      expiresAt: body.expiresAt ? String(body.expiresAt) : undefined
    });

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
