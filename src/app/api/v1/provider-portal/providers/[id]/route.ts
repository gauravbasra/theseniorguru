import { NextResponse } from "next/server";
import { submitProviderPortalUpdate } from "@/lib/providers/profile-updates";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    return NextResponse.json({
      data: await submitProviderPortalUpdate({
        ...body,
        providerId: id
      })
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
