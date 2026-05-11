import { NextResponse } from "next/server";
import { decideDataSourceReview } from "@/lib/data-sources";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await decideDataSourceReview(id, {
        actorId: typeof body.actorId === "string" ? body.actorId : undefined,
        reviewStatus: "blocked",
        robotsStatus: typeof body.robotsStatus === "string" ? body.robotsStatus : "blocked",
        termsNotes: typeof body.termsNotes === "string" ? body.termsNotes : undefined,
        decisionNotes: typeof body.decisionNotes === "string" ? body.decisionNotes : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
