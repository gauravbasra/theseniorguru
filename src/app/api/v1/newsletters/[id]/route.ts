import { NextResponse } from "next/server";
import { getNewsletterEdition } from "@/lib/newsroom/newsroom";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const edition = await getNewsletterEdition(id, { publicOnly: true });

    if (!edition) {
      return NextResponse.json({ error: "Newsletter edition not found" }, { status: 404 });
    }

    return NextResponse.json({ data: edition });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
