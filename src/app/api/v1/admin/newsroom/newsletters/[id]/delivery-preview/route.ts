import { NextResponse } from "next/server";
import { previewNewsletterDelivery } from "@/lib/newsroom/newsroom";

export async function POST(request: Request, context: { params: Promise<unknown> }) {
  try {
    const params = await context.params;
    const id = typeof params === "object" && params && "id" in params ? String(params.id) : "";
    const body = await request.json().catch(() => ({}));

    if (!id) {
      return NextResponse.json({ error: "Newsletter id is required" }, { status: 422 });
    }

    const preview = await previewNewsletterDelivery({
      editionId: id,
      deliveryProvider: body.deliveryProvider,
      actorId: body.actorId,
      notes: body.notes
    });

    return NextResponse.json({ data: preview }, { status: preview.status === "ready" ? 200 : 424 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
