#!/usr/bin/env node

const apiBase = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "https://mobile-api-nine.vercel.app";
const adminEmail = process.env.LAUNCH_ADMIN_EMAIL || "admin@theseniorguru.local";

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch (error) {
    json = { raw: text };
  }
  if (!response.ok) {
    const message = json.error || json.message || `HTTP ${response.status}`;
    const failure = new Error(message);
    failure.status = response.status;
    failure.details = json;
    throw failure;
  }
  return json;
}

function extractToken(sessionResponse) {
  return sessionResponse.token || sessionResponse.sessionToken || sessionResponse.session?.token || sessionResponse.auth?.token;
}

async function main() {
  console.log(`Launch readiness smoke: ${apiBase}`);
  const session = await request("/api/auth/dev-session", {
    method: "POST",
    body: JSON.stringify({ email: adminEmail })
  });
  const token = extractToken(session);
  if (!token) {
    throw new Error("Dev session did not return a bearer token.");
  }
  const readiness = await request("/api/superadmin/launch-readiness", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` }
  });
  console.log(`Launch target: ${readiness.launchTarget}`);
  console.log(`Launchable: ${readiness.launchable ? "yes" : "no"}`);
  console.log(`Environment: ${readiness.environment}`);
  console.log(`Evaluated at: ${readiness.evaluatedAt}`);
  console.log("");
  console.log("Checks:");
  for (const check of readiness.checks || []) {
    console.log(`- [${check.status}] ${check.label}: ${check.detail}`);
  }
  if (readiness.blockers?.length) {
    console.log("");
    console.log("Launch blockers:");
    for (const blocker of readiness.blockers) {
      console.log(`- ${blocker.label}: ${blocker.detail}`);
    }
    process.exitCode = 1;
    return;
  }
  if (readiness.warnings?.length) {
    console.log("");
    console.log("Warnings / gated items:");
    for (const warning of readiness.warnings) {
      console.log(`- ${warning.label}: ${warning.detail}`);
    }
  }
}

main().catch(error => {
  console.error(`Launch readiness smoke failed: ${error.message}`);
  if (error.details) {
    console.error(JSON.stringify(error.details, null, 2));
  }
  process.exitCode = 1;
});
