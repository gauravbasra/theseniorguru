import { NextResponse } from "next/server";
import { getNewsroomReadiness } from "@/lib/newsroom/newsroom";

export async function GET() {
  try {
    return NextResponse.json({ data: await getNewsroomReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
