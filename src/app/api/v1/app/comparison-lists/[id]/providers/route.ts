import { NextResponse, type NextRequest } from "next/server";
import { addComparisonListProvider } from "@/lib/mobile/stickiness";
import { resolveAppUserKey } from "@/lib/mobile/session";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const userKey = await resolveAppUserKey(request, body.userKey);

    if (!body.providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    return NextResponse.json(
      {
        data: await addComparisonListProvider({
          comparisonListId: id,
          providerId: body.providerId,
          userKey
        })
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("does not match") ? 422 : 500 });
  }
}
