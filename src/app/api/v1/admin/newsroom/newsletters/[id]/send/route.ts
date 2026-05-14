import { NextResponse } from "next/server";
import { sendNewsletterDelivery } from "@/lib/newsroom/newsroom";

export async function POST(request: Request, context: { params: Promise<unknown> }) {
  try {
    const params = await context.params;
    const id = typeof params === "object" && params && "id" in params ? String(params.id) : "";
    const body = await request.json().catch(() => ({}));

    if (!id) {
      return NextResponse.json({ error: "Newsletter id is required" }, { status: 422 });
    }

    const result = await sendNewsletterDelivery({
      editionId: id,
      actorId: body.actorId,
      notes: body.notes,
      deliveryProvider: body.deliveryProvider,
      dryRun: Boolean(body.dryRun),
      deliveryId: typeof body.deliveryId === "string" ? body.deliveryId : undefined
    });

    return NextResponse.json({
      data: result
    }, { status: result.status === "blocked" ? 424 : 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.includes("not found") ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
