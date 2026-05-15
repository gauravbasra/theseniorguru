import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    data: {
      app: "theseniorguru",
      runtime: "next",
      marker: "theseniorguru-next-runtime",
      generatedAt: new Date().toISOString()
    }
  });
}
