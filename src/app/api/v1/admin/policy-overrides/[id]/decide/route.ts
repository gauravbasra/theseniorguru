import { NextResponse } from "next/server";
import { decidePolicyOverrideRequest } from "@/lib/policy";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (body.decision !== "approved" && body.decision !== "rejected") {
      return NextResponse.json({ error: "decision must be approved or rejected" }, { status: 422 });
    }

    return NextResponse.json({
      data: await decidePolicyOverrideRequest({
        id,
        decision: body.decision,
        reviewedBy: body.reviewedBy ? String(body.reviewedBy) : "admin",
        reviewNotes: body.reviewNotes ? String(body.reviewNotes) : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
