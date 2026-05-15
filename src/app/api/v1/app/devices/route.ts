import { NextResponse, type NextRequest } from "next/server";
import { listAppDevices, registerAppDevice } from "@/lib/mobile/devices";
import { resolveAppUserKey } from "@/lib/mobile/session";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userKey = await resolveAppUserKey(request, searchParams.get("userKey"));

    return NextResponse.json({ data: await listAppDevices(userKey) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.includes("required") || message.includes("does not match") ? 422 : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userKey = await resolveAppUserKey(request, body.userKey);

    return NextResponse.json(
      {
        data: await registerAppDevice({
          userKey,
          platform: body.platform,
          deviceId: body.deviceId,
          pushToken: body.pushToken,
          tokenProvider: body.tokenProvider,
          appVersion: body.appVersion,
          locale: body.locale
        })
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const status =
      message.includes("required") ||
      message.includes("does not match") ||
      message.includes("pushToken") ||
      message.includes("platform")
        ? 422
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
