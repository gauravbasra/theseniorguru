import { NextResponse } from "next/server";
import { getVendorFeedReadiness, upsertVendorFeedConnection } from "@/lib/aggregation/vendor-feed-connections";

export async function GET() {
  try {
    return NextResponse.json({ data: await getVendorFeedReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));

    if (!body.dataSourceId || !body.vendorName) {
      return NextResponse.json({ error: "dataSourceId and vendorName are required" }, { status: 422 });
    }

    if (body.credentialSecret) {
      return NextResponse.json(
        { error: "Do not submit vendor secrets to this API; pass only a credentialReference." },
        { status: 422 }
      );
    }

    return NextResponse.json({ data: await upsertVendorFeedConnection(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
