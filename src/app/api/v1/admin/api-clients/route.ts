import { NextResponse } from "next/server";
import { createApiClient, listApiClients } from "@/lib/openapi/platform";

export async function GET() {
  try {
    return NextResponse.json({ data: await listApiClients() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createApiClient(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
