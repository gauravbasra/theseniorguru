import { NextResponse } from "next/server";
import { rankExpertAnswers } from "@/lib/community/experts";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (typeof body.question !== "string" || !body.question.trim()) {
      return NextResponse.json({ error: "question is required" }, { status: 422 });
    }

    return NextResponse.json({
      data: await rankExpertAnswers({
        question: body.question,
        city: typeof body.city === "string" ? body.city : undefined,
        state: typeof body.state === "string" ? body.state : undefined,
        topicKey: typeof body.topicKey === "string" ? body.topicKey : undefined,
        limit: typeof body.limit === "number" ? body.limit : undefined,
        actorId: typeof body.actorId === "string" ? body.actorId : undefined
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
