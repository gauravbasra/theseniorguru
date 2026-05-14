import { NextResponse } from "next/server";
import type { PolicyReviewAssignmentRole } from "@/lib/domain/providers";
import { assignPolicyReview, getPolicyReviewAssignments } from "@/lib/policy";

const allowedRoles: PolicyReviewAssignmentRole[] = ["policy_reviewer", "legal_reviewer", "expert_reviewer", "launch_owner"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = Number(searchParams.get("limit") ?? 100);

    return NextResponse.json({
      data: await getPolicyReviewAssignments({
        policyCheckId: searchParams.get("policyCheckId") ?? undefined,
        limit: Number.isFinite(limit) ? limit : 100
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const assignedRole = body.assignedRole ? String(body.assignedRole) : undefined;

    if (assignedRole && !allowedRoles.includes(assignedRole as PolicyReviewAssignmentRole)) {
      return NextResponse.json({ error: "assignedRole is not supported" }, { status: 422 });
    }

    const result = await assignPolicyReview({
      policyCheckId: body.policyCheckId ? String(body.policyCheckId) : undefined,
      assignedTo: body.assignedTo ? String(body.assignedTo) : undefined,
      assignedRole: assignedRole as PolicyReviewAssignmentRole | undefined,
      assignedBy: body.assignedBy ? String(body.assignedBy) : undefined,
      dueAt: body.dueAt ? String(body.dueAt) : undefined,
      notes: body.notes ? String(body.notes) : undefined,
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : undefined,
      limit: Number.isFinite(Number(body.limit)) ? Number(body.limit) : undefined
    });

    return NextResponse.json({ data: result }, { status: result.status === "blocked" ? 422 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
