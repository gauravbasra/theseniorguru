import { NextResponse } from "next/server";
import type { WebhookDeliveryRecord, WebhookEventType } from "@/lib/domain/open-api";
import { exportWebhookReplayEvidence } from "@/lib/openapi/platform";

const allowedFormats = ["json", "csv"] as const;
const allowedStatuses: WebhookDeliveryRecord["status"][] = ["queued", "delivered", "failed", "blocked"];
const allowedEvents: WebhookEventType[] = [
  "provider.claimed",
  "provider.updated",
  "provider.contact.created",
  "review.created",
  "review.response.published",
  "event.created",
  "event.rsvp.created",
  "campaign.published",
  "campaign.metric.updated",
  "ad.impression.recorded",
  "ad.click.recorded",
  "community.post.created"
];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const limit = Number(searchParams.get("limit") ?? 100);
    const eventType = searchParams.get("eventType") ?? undefined;
    const sourceStatus = searchParams.get("sourceStatus") ?? undefined;
    const replayStatus = searchParams.get("replayStatus") ?? undefined;
    const since = searchParams.get("since") ?? undefined;
    const before = searchParams.get("before") ?? undefined;

    if (!allowedFormats.includes(format as (typeof allowedFormats)[number])) {
      return NextResponse.json({ error: "format must be json or csv" }, { status: 422 });
    }

    if (eventType && !allowedEvents.includes(eventType as WebhookEventType)) {
      return NextResponse.json({ error: "eventType is not a supported webhook event" }, { status: 422 });
    }

    if (sourceStatus && !allowedStatuses.includes(sourceStatus as WebhookDeliveryRecord["status"])) {
      return NextResponse.json({ error: "sourceStatus must be queued, delivered, failed, or blocked" }, { status: 422 });
    }

    if (replayStatus && !allowedStatuses.includes(replayStatus as WebhookDeliveryRecord["status"])) {
      return NextResponse.json({ error: "replayStatus must be queued, delivered, failed, or blocked" }, { status: 422 });
    }

    if (since && Number.isNaN(Date.parse(since))) {
      return NextResponse.json({ error: "since must be a valid ISO date" }, { status: 422 });
    }

    if (before && Number.isNaN(Date.parse(before))) {
      return NextResponse.json({ error: "before must be a valid ISO date" }, { status: 422 });
    }

    const exportPayload = await exportWebhookReplayEvidence({
      format: format as "json" | "csv",
      limit: Number.isFinite(limit) ? limit : 100,
      apiClientId: searchParams.get("apiClientId") ?? undefined,
      eventType: eventType as WebhookEventType | undefined,
      sourceStatus: sourceStatus as WebhookDeliveryRecord["status"] | undefined,
      replayStatus: replayStatus as WebhookDeliveryRecord["status"] | undefined,
      subjectId: searchParams.get("subjectId") ?? undefined,
      since,
      before,
      auditedOnly: searchParams.get("auditedOnly") === "true"
    });

    if (format === "csv") {
      return new NextResponse(exportPayload.csv ?? "", {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="${exportPayload.filename}"`
        }
      });
    }

    return NextResponse.json({ data: exportPayload });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
