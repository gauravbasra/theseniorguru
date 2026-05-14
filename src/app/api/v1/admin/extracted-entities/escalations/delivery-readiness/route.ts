import { NextResponse } from "next/server";
import { getExtractedEntityEscalationDeliveryReadiness } from "@/lib/aggregation/extracted-entities";

export async function GET() {
  try {
    return NextResponse.json({ data: await getExtractedEntityEscalationDeliveryReadiness() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
