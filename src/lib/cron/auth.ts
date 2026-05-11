import { getAppEnv } from "@/lib/env";

export function getExpectedCronSecret() {
  const env = getAppEnv();

  if (env.cronSecret) {
    return env.cronSecret;
  }

  return process.env.NODE_ENV === "production" ? null : "local-cron-secret";
}

export function isAuthorizedCronRequest(request: Request) {
  const expected = getExpectedCronSecret();

  if (!expected) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${expected}`;
}
