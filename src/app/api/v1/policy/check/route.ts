import { NextResponse } from "next/server";
import { runPolicyCheck } from "@/lib/policy";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.subjectType || !body.actionKey || typeof body.input !== "object") {
      return NextResponse.json({ error: "subjectType, actionKey, and input are required" }, { status: 422 });
    }

    const result = await runPolicyCheck({
      subjectType: body.subjectType,
      subjectId: body.subjectId,
      actionKey: body.actionKey,
      input: body.input
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
