import { NextResponse } from "next/server";
import { createDataSource, listDataSources } from "@/lib/data-sources";

export async function GET() {
  try {
    return NextResponse.json({ data: await listDataSources() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.name || !body.sourceType) {
      return NextResponse.json({ error: "name and sourceType are required" }, { status: 422 });
    }

    const source = await createDataSource({
      name: body.name,
      sourceType: body.sourceType,
      baseUrl: body.baseUrl,
      jurisdiction: body.jurisdiction,
      reviewStatus: body.reviewStatus ?? "pending",
      robotsStatus: body.robotsStatus,
      termsNotes: body.termsNotes,
      approvedAt: body.approvedAt
    });

    return NextResponse.json({ data: source }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

