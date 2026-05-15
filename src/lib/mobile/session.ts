import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { recordAuditEvent } from "@/lib/audit-events";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

export const appSessionCookieName = "tsg_app_session";

const sessionTtlSeconds = 60 * 60 * 24 * 90;
const encoder = new TextEncoder();

type AppSessionPayload = {
  sub: string;
  role: "senior" | "family" | "caregiver" | "advisor";
  iat: number;
  exp: number;
};

type ConsumerProfileInput = {
  userKey?: string;
  displayName?: string;
  email?: string;
  role?: AppSessionPayload["role"];
};

export type AppSessionRecord = {
  userKey: string;
  role: AppSessionPayload["role"];
  displayName?: string;
  email?: string;
  token: string;
  expiresAt: string;
  sessionTtlSeconds: number;
};

function base64UrlEncode(value: ArrayBuffer | string) {
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}

function appSessionSecret() {
  return process.env.APP_SESSION_SECRET ?? process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_ACCESS_CODE ?? "local-senior-guru-app-session-secret";
}

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return base64UrlEncode(signature);
}

function normalizeRole(value: unknown): AppSessionPayload["role"] {
  return value === "senior" || value === "caregiver" || value === "advisor" ? value : "family";
}

function normalizeUserKey(value?: string) {
  const cleaned = value?.trim();
  return cleaned || `consumer-${randomUUID()}`;
}

async function persistConsumerProfile(input: {
  userKey: string;
  displayName?: string;
  email?: string;
  role: AppSessionPayload["role"];
}) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return;
  }

  const { error } = await supabase.from("consumer_profiles").upsert(
    {
      user_key: input.userKey,
      display_name: input.displayName,
      email: input.email,
      role: input.role,
      last_seen_at: new Date().toISOString()
    },
    { onConflict: "user_key" }
  );

  if (error) {
    throw new Error(`Consumer profile session binding failed: ${error.message}`);
  }
}

export function getAppSessionConfig() {
  return {
    configured: Boolean(process.env.APP_SESSION_SECRET),
    sessionTtlSeconds
  };
}

export async function createAppSession(input: ConsumerProfileInput = {}, now = Math.floor(Date.now() / 1000)) {
  const role = normalizeRole(input.role);
  const userKey = normalizeUserKey(input.userKey);
  const payload: AppSessionPayload = {
    sub: userKey,
    role,
    iat: now,
    exp: now + sessionTtlSeconds
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload);
  const token = `${encodedPayload}.${signature}`;

  await persistConsumerProfile({
    userKey,
    displayName: input.displayName,
    email: input.email,
    role
  });
  await recordAuditEvent({
    actorType: "family",
    actorId: userKey,
    eventType: "app_session.created",
    subjectType: "consumer_profile",
    subjectId: userKey,
    payload: {
      role,
      displayName: input.displayName,
      hasEmail: Boolean(input.email),
      sessionTtlSeconds
    }
  });

  return {
    userKey,
    role,
    displayName: input.displayName,
    email: input.email,
    token,
    expiresAt: new Date(payload.exp * 1000).toISOString(),
    sessionTtlSeconds
  } satisfies AppSessionRecord;
}

export async function verifyAppSessionToken(token?: string | null) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || signature !== await sign(encodedPayload)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AppSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (!payload.sub || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getAppSessionFromRequest(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : undefined;

  return verifyAppSessionToken(bearerToken ?? request.cookies.get(appSessionCookieName)?.value);
}

export async function resolveAppUserKey(request: NextRequest, explicitUserKey?: unknown) {
  const session = await getAppSessionFromRequest(request);
  const requestedUserKey = typeof explicitUserKey === "string" ? explicitUserKey.trim() : "";

  if (session?.sub && requestedUserKey && requestedUserKey !== session.sub) {
    throw new Error("Session userKey does not match request userKey");
  }

  if (session?.sub) {
    return session.sub;
  }

  if (requestedUserKey) {
    return requestedUserKey;
  }

  throw new Error("App session or userKey is required");
}
