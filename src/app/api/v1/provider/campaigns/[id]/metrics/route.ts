import { NextResponse } from "next/server";
import { CampaignMetricIngestionError, recordCampaignMetric } from "@/lib/campaigns/campaigns";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const result = await recordCampaignMetric({
      campaignId: id,
      metricKey: body.metricKey,
      metricValue: body.metricValue,
      metricPayload: body.metricPayload,
      recordedAt: body.recordedAt
    });

    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof CampaignMetricIngestionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
