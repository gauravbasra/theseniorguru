import { NextResponse } from "next/server";
import {
  getProviderWebsiteParserReadiness,
  runProviderWebsiteParser
} from "@/lib/aggregation/provider-website-parser";

export async function GET() {
  try {
    return NextResponse.json({ data: await getProviderWebsiteParserReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.crawlJobId) {
      return NextResponse.json({ error: "crawlJobId is required" }, { status: 422 });
    }

    return NextResponse.json({ data: await runProviderWebsiteParser(body) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
