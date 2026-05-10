import { NextResponse } from "next/server";
import { addComparisonListProvider } from "@/lib/mobile/stickiness";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    if (!body.providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    return NextResponse.json(
      {
        data: await addComparisonListProvider({
          comparisonListId: id,
          providerId: body.providerId,
          userKey: body.userKey
        })
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
