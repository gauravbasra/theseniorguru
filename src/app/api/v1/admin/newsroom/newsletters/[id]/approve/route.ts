import { NextResponse } from "next/server";
import { approveNewsletterEdition } from "@/lib/newsroom/newsroom";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    return NextResponse.json({
      data: await approveNewsletterEdition(id, {
        actorId: body.actorId,
        notes: body.notes
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
