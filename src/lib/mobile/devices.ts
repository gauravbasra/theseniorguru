import { recordAuditEvent } from "@/lib/audit-events";
import type { AppDevicePlatform, AppDeviceRegistrationRecord, RegisterAppDeviceInput } from "@/lib/domain/mobile";
import { runPolicyCheck } from "@/lib/policy";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedAppDevices: AppDeviceRegistrationRecord[] = [];

function mapAppDevice(row: Record<string, unknown>): AppDeviceRegistrationRecord {
  return {
    id: String(row.id),
    userKey: String(row.user_key),
    platform: row.platform as AppDevicePlatform,
    deviceId: row.device_id ? String(row.device_id) : undefined,
    pushToken: String(row.push_token),
    tokenProvider: row.token_provider as AppDeviceRegistrationRecord["tokenProvider"],
    appVersion: row.app_version ? String(row.app_version) : undefined,
    locale: row.locale ? String(row.locale) : undefined,
    status: row.status === "disabled" ? "disabled" : "active",
    createdAt: String(row.created_at),
    updatedAt: row.updated_at ? String(row.updated_at) : undefined
  };
}

function normalizePlatform(value: unknown): AppDevicePlatform | undefined {
  return value === "ios" || value === "android" || value === "web" ? value : undefined;
}

function defaultTokenProvider(platform: AppDevicePlatform): AppDeviceRegistrationRecord["tokenProvider"] {
  if (platform === "ios") return "apns";
  if (platform === "android") return "fcm";
  return "web_push";
}

function normalizeTokenProvider(
  value: unknown,
  platform: AppDevicePlatform
): AppDeviceRegistrationRecord["tokenProvider"] {
  return value === "apns" || value === "fcm" || value === "web_push" || value === "expo"
    ? value
    : defaultTokenProvider(platform);
}

function validatePushToken(value: unknown) {
  const token = typeof value === "string" ? value.trim() : "";

  if (token.length < 12 || token.length > 4096) {
    throw new Error("pushToken must be between 12 and 4096 characters");
  }

  return token;
}

function maskPushToken(token: string) {
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

export async function listAppDevices(userKey: string): Promise<AppDeviceRegistrationRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedAppDevices.filter((device) => device.userKey === userKey && device.status === "active");
  }

  const { data, error } = await supabase
    .from("app_device_registrations")
    .select("*")
    .eq("user_key", userKey)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(`App device query failed: ${error.message}`);
  }

  return (data ?? []).map(mapAppDevice);
}

export async function registerAppDevice(input: RegisterAppDeviceInput): Promise<AppDeviceRegistrationRecord> {
  const platform = normalizePlatform(input.platform);

  if (!platform) {
    throw new Error("platform must be ios, android, or web");
  }

  const pushToken = validatePushToken(input.pushToken);
  const tokenProvider = normalizeTokenProvider(input.tokenProvider, platform);
  const policy = await runPolicyCheck({
    subjectType: "app_device_registration",
    subjectId: input.userKey,
    actionKey: "register_app_device",
    input: {
      userKey: input.userKey,
      platform,
      deviceId: input.deviceId,
      tokenProvider,
      appVersion: input.appVersion,
      locale: input.locale,
      pushTokenMasked: maskPushToken(pushToken)
    }
  });

  if (policy.decision === "blocked" || policy.decision === "blocked_non_overridable") {
    throw new Error(policy.reasons[0] ?? "App device registration blocked by policy");
  }

  const now = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const existing = seedAppDevices.find(
      (device) =>
        device.userKey === input.userKey &&
        ((input.deviceId && device.deviceId === input.deviceId) || device.pushToken === pushToken)
    );
    const record: AppDeviceRegistrationRecord = {
      id: existing?.id ?? `app-device-${Date.now()}`,
      userKey: input.userKey,
      platform,
      deviceId: input.deviceId,
      pushToken,
      tokenProvider,
      appVersion: input.appVersion,
      locale: input.locale,
      status: "active",
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    };

    if (existing) {
      Object.assign(existing, record);
    } else {
      seedAppDevices.unshift(record);
    }

    await recordAuditEvent({
      actorType: "family",
      actorId: input.userKey,
      eventType: "app_device.registered",
      subjectType: "app_device_registration",
      subjectId: record.id,
      payload: {
        platform,
        tokenProvider,
        deviceId: input.deviceId,
        pushTokenMasked: maskPushToken(pushToken),
        appVersion: input.appVersion,
        locale: input.locale,
        policyDecision: policy.decision
      }
    });

    return record;
  }

  const { data, error } = await supabase
    .from("app_device_registrations")
    .upsert(
      {
        user_key: input.userKey,
        platform,
        device_id: input.deviceId,
        push_token: pushToken,
        token_provider: tokenProvider,
        app_version: input.appVersion,
        locale: input.locale,
        status: "active",
        updated_at: now
      },
      { onConflict: input.deviceId ? "user_key,device_id" : "user_key,push_token" }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`App device registration failed: ${error.message}`);
  }

  const record = mapAppDevice(data);

  await recordAuditEvent({
    actorType: "family",
    actorId: input.userKey,
    eventType: "app_device.registered",
    subjectType: "app_device_registration",
    subjectId: record.id,
    payload: {
      platform,
      tokenProvider,
      deviceId: input.deviceId,
      pushTokenMasked: maskPushToken(pushToken),
      appVersion: input.appVersion,
      locale: input.locale,
      policyDecision: policy.decision
    }
  });

  return record;
}
