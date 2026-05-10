import { NextResponse } from "next/server";
import { createCrawlJob, listCrawlJobs } from "@/lib/aggregation/crawl-jobs";

export async function GET() {
  try {
    return NextResponse.json({ data: await listCrawlJobs() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.dataSourceId || !body.seedUrl) {
      return NextResponse.json({ error: "dataSourceId and seedUrl are required" }, { status: 422 });
    }

    return NextResponse.json({ data: await createCrawlJob(body) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
