import { NextResponse, type NextRequest } from "next/server";
import { listCareCircles, sendCareCircleMemberInvite } from "@/lib/mobile/stickiness";
import { resolveAppUserKey } from "@/lib/mobile/session";

async function assertOwnedCareCircle(request: NextRequest, careCircleId: string, explicitUserKey?: unknown) {
  const userKey = await resolveAppUserKey(request, explicitUserKey);
  const circles = await listCareCircles(userKey);

  if (!circles.some((circle) => circle.id === careCircleId)) {
    throw new Error("Care circle not found for app session");
  }

  return userKey;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const { id, memberId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const actorUserKey = await assertOwnedCareCircle(request, id, body.userKey);

    return NextResponse.json({
      data: await sendCareCircleMemberInvite({
        careCircleId: id,
        memberId,
        actorUserKey,
        dryRun: body.dryRun === undefined ? true : Boolean(body.dryRun),
        deliveryProvider:
          body.deliveryProvider === "internal_notification_queue" ? "internal_notification_queue" : "manual_export"
      })
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: message.includes("required") || message.includes("not found") ? 422 : 500 }
    );
  }
}
