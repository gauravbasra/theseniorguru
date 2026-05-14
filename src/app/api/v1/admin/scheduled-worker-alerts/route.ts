import { NextResponse } from "next/server";
import type { ScheduledWorkerAlertDeliveryProvider } from "@/lib/domain/scheduler";
import { notifyScheduledWorkerAlerts } from "@/lib/scheduler/runs";

const allowedProviders: ScheduledWorkerAlertDeliveryProvider[] = ["manual_export", "internal_notification_queue"];

function parseProvider(value: unknown): ScheduledWorkerAlertDeliveryProvider {
  return allowedProviders.includes(value as ScheduledWorkerAlertDeliveryProvider)
    ? (value as ScheduledWorkerAlertDeliveryProvider)
    : "manual_export";
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await notifyScheduledWorkerAlerts({
      dryRun: typeof body.dryRun === "boolean" ? body.dryRun : true,
      deliveryProvider: parseProvider(body.deliveryProvider),
      actorId: body.actorId ? String(body.actorId) : undefined
    });

    return NextResponse.json({ data: result }, { status: result.status === "blocked" ? 422 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
