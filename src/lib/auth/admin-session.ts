import type { NextRequest } from "next/server";

export const adminSessionCookieName = "tsg_admin_session";

const sessionTtlSeconds = 60 * 60 * 8;
const encoder = new TextEncoder();

type AdminSessionPayload = {
  sub: "owner";
  role: "admin";
  iat: number;
  exp: number;
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

async function sign(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(getAdminSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));

  return base64UrlEncode(signature);
}

function getAdminAccessCode() {
  return process.env.ADMIN_ACCESS_CODE ?? "theseniorguru-launch-2026";
}

function getAdminSessionSecret() {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.ADMIN_ACCESS_CODE ?? "local-senior-guru-session-secret";
}

export function getAdminAuthConfig() {
  return {
    configured: Boolean(process.env.ADMIN_ACCESS_CODE && process.env.ADMIN_SESSION_SECRET),
    sessionTtlSeconds
  };
}

export function isAdminAccessCodeValid(accessCode: string) {
  return accessCode.trim() === getAdminAccessCode();
}

export async function createAdminSessionToken(now = Math.floor(Date.now() / 1000)) {
  const payload: AdminSessionPayload = {
    sub: "owner",
    role: "admin",
    iat: now,
    exp: now + sessionTtlSeconds
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = await sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(token?: string) {
  if (!token) {
    return null;
  }

  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature || signature !== await sign(encodedPayload)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as AdminSessionPayload;
    const now = Math.floor(Date.now() / 1000);

    if (payload.sub !== "owner" || payload.role !== "admin" || payload.exp <= now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function getAdminSessionFromRequest(request: NextRequest) {
  return verifyAdminSessionToken(request.cookies.get(adminSessionCookieName)?.value);
}

