import { NextResponse } from "next/server";
import { getProviderProfileCompletionAssistant } from "@/lib/provider-dashboard/profile-completion-assistant";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const providerId = searchParams.get("providerId");

    if (!providerId) {
      return NextResponse.json({ error: "providerId is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await getProviderProfileCompletionAssistant(providerId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message === "Provider not found" ? 404 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
