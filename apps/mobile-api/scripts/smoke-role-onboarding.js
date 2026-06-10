#!/usr/bin/env node

const assert = require("assert");

const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:4187";

async function request(path, options = {}, expectedStatuses = [200]) {
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
  } catch {
    json = { raw: text };
  }
  if (!expectedStatuses.includes(response.status)) {
    const error = new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${json.error || text}`);
    error.details = json;
    throw error;
  }
  return json;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function roleSession(role, displayName) {
  const session = await request("/api/auth/device-session", {
    method: "POST",
    body: JSON.stringify({
      installationId: `role-onboarding-${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      displayName
    })
  });
  assert.equal(session.user.role, role, `${role} session must return role`);
  assert.ok(session.token, `${role} session must return token`);
  return session;
}

async function main() {
  console.log(`Role onboarding smoke: ${apiBase}`);

  const senior = await roleSession("senior", "Anita");
  const seniorOnboarding = await request("/api/onboarding/senior", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({
      name: "Anita Sharma",
      preferredName: "Anita",
      phone: "+13035550101",
      email: "anita@theseniorguru.local",
      address: "Park View Community",
      livingType: "community",
      healthConcerns: ["blood pressure"],
      allergies: "Seasonal pollen",
      mobility: "Uses walker for longer distances",
      wearableSources: ["apple_healthkit", "android_health_connect"],
      devicePermissions: ["location", "health", "notifications"],
      healthSharing: true,
      locationSharing: true
    })
  });
  assert.ok(seniorOnboarding.onboarding?.session?.id, "senior onboarding must write session");
  const seniorState = await request("/api/state", { headers: auth(senior.token) });
  assert.equal(seniorState.user.role, "senior", "senior state must load");
  assert.ok(seniorState.resident?.id, "senior state must include resident");

  const trusted = await roleSession("trusted_person", "Rita Sharma");
  const trustedOnboarding = await request("/api/onboarding/trust-circle", {
    method: "POST",
    headers: auth(trusted.token),
    body: JSON.stringify({
      inviteCode: "RITA-ANITA",
      name: "Rita Sharma",
      relationship: "Daughter",
      phone: "+13035550102",
      email: "rita@theseniorguru.local",
      timezone: "America/Denver",
      escalationRole: "Primary family contact",
      routineWindow: "8:00 AM - 8:00 PM",
      quietHours: "10:00 PM - 7:00 AM",
      emergencyOverride: "Yes",
      alertTypes: ["sos", "falls", "medications", "daily_status"],
      visibility: ["summary", "safety", "medications", "rides"]
    })
  });
  assert.ok(trustedOnboarding.onboarding?.session?.id, "trusted onboarding must write session");
  assert.ok(trustedOnboarding.onboarding?.connection?.id, "trusted invite must create trusted connection");
  const trustedState = await request("/api/state", { headers: auth(trusted.token) });
  assert.equal(trustedState.user.role, "trusted_person", "trusted state must load");
  assert.ok(trustedState.connections?.length, "trusted state must include senior connection");

  const business = await roleSession("business", "Rohit Mehta");
  const businessStateBefore = await request("/api/state", { headers: auth(business.token) });
  assert.equal(businessStateBefore.user.role, "business", "business state must load");
  assert.ok(businessStateBefore.business?.id, "business device session must create business shell");
  const businessOnboarding = await request("/api/onboarding/business", {
    method: "POST",
    headers: auth(business.token),
    body: JSON.stringify({
      legalName: "CareRide Senior Transportation LLC",
      dba: "CareRide",
      ownerName: "Rohit Mehta",
      phone: "+13035550104",
      email: "rohit@careride.local",
      website: "https://careride.example",
      businessType: "transportation",
      address: "Denver, CO",
      services: "Doctor appointment rides, pharmacy pickup, wheelchair assisted rides",
      pricing: "$18 - $35 local rides",
      serviceRadius: "25",
      serviceZips: "80124, 80126, 80129, 80202",
      leadTypes: ["rides", "appointments", "pharmacy"],
      communication: ["app", "sms", "phone"],
      maxLeads: "12",
      verificationDocs: ["business_license", "insurance"]
    })
  });
  assert.ok(businessOnboarding.onboarding?.session?.id, "business onboarding must write session");
  assert.ok(businessOnboarding.onboarding?.businessProfile?.id, "business onboarding must write business profile");
  const businessStateAfter = await request("/api/state", { headers: auth(business.token) });
  assert.equal(businessStateAfter.business?.status, "pending_review", "business profile should be submitted for review");

  console.log("Role onboarding smoke passed");
}

main().catch(error => {
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
});
