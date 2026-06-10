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
      installationId: `role-settings-${role}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      role,
      displayName
    })
  });
  assert.equal(session.user.role, role, `${role} session must return role`);
  assert.ok(session.token, `${role} session must return token`);
  return session;
}

async function main() {
  console.log(`Role settings smoke: ${apiBase}`);

  const senior = await roleSession("senior", "Resident Settings Smoke");
  await request("/api/onboarding/senior", {
    method: "POST",
    headers: auth(senior.token),
    body: JSON.stringify({
      name: "Resident Settings Smoke",
      preferredName: "Resident",
      phone: "+13035551001",
      email: "resident-settings-smoke@theseniorguru.test",
      address: "Settings Smoke Community",
      livingType: "community",
      healthConcerns: ["mobility"],
      allergies: "None",
      mobility: "Independent",
      wearableSources: ["apple_healthkit"],
      devicePermissions: ["location", "health"],
      healthSharing: true,
      locationSharing: true
    })
  });
  const seniorSettings = await request("/api/settings/senior", {
    method: "PATCH",
    headers: auth(senior.token),
    body: JSON.stringify({
      preferredName: "Resident Updated",
      community: "Updated Settings Community",
      healthConcerns: ["mobility", "sleep"],
      mobilityNotes: "Uses elevator for long distances",
      wearableSources: ["apple_healthkit", "android_health_connect"],
      healthDataScopes: ["steps", "sleep", "heartRate"]
    })
  });
  assert.equal(seniorSettings.settings.resident.community, "Updated Settings Community", "senior settings must update resident community");
  const seniorState = await request("/api/state", { headers: auth(senior.token) });
  assert.equal(seniorState.resident.community, "Updated Settings Community", "senior state must read patched community");

  const trusted = await roleSession("trusted_person", "Trusted Settings Smoke");
  await request("/api/onboarding/trust-circle", {
    method: "POST",
    headers: auth(trusted.token),
    body: JSON.stringify({
      inviteCode: "RITA-ANITA",
      name: "Trusted Settings Smoke",
      relationship: "Daughter",
      phone: "+13035551002",
      email: "trusted-settings-smoke@theseniorguru.test",
      timezone: "America/Denver",
      escalationRole: "Primary family contact",
      routineWindow: "8:00 AM - 8:00 PM",
      quietHours: "10:00 PM - 7:00 AM",
      emergencyOverride: "Yes",
      alertTypes: ["sos", "falls"],
      visibility: ["summary", "safety"]
    })
  });
  const trustedSettings = await request("/api/settings/trust-circle", {
    method: "PATCH",
    headers: auth(trusted.token),
    body: JSON.stringify({
      fullName: "Trusted Settings Updated",
      relationship: "Care partner",
      alertTypes: ["sos", "medications", "daily_status"],
      visibility: ["summary", "safety", "medications"],
      messagingRules: {
        routineWindow: "9:00 AM - 7:00 PM",
        quietHours: "9:00 PM - 7:00 AM"
      }
    })
  });
  assert.equal(trustedSettings.settings.trustCircleProfile.relationship, "Care partner", "trusted settings must update relationship");
  const trustedState = await request("/api/state", { headers: auth(trusted.token) });
  assert.ok(trustedState.connections?.length, "trusted settings must preserve senior connection");

  const business = await roleSession("business", "Business Settings Smoke");
  await request("/api/onboarding/business", {
    method: "POST",
    headers: auth(business.token),
    body: JSON.stringify({
      legalName: "Business Settings Smoke LLC",
      dba: "Business Settings Smoke",
      ownerName: "Owner Settings Smoke",
      phone: "+13035551003",
      email: "business-settings-smoke@theseniorguru.test",
      businessType: "transportation",
      address: "Denver, CO",
      services: "Local rides",
      pricing: "$25 local rides",
      serviceRadius: "10",
      serviceZips: "80202",
      leadTypes: ["rides"],
      communication: ["app"],
      maxLeads: "4"
    })
  });
  const businessSettings = await request("/api/settings/business", {
    method: "PATCH",
    headers: auth(business.token),
    body: JSON.stringify({
      dba: "Business Settings Updated",
      ownerName: "Owner Updated",
      serviceAreas: ["80202", "80203"],
      serviceRadius: "15",
      leadTypes: ["rides", "appointments"],
      communication: ["app", "sms"],
      leadRules: {
        maxLeadsPerDay: 6,
        minimumJobValue: 20,
        acceptUrgentRequests: true,
        acceptRecurringRequests: true
      }
    })
  });
  assert.equal(businessSettings.settings.business.name, "Business Settings Updated", "business settings must update business name");
  const businessState = await request("/api/state", { headers: auth(business.token) });
  assert.equal(businessState.business.name, "Business Settings Updated", "business state must read patched name");

  console.log("Role settings smoke passed");
}

main().catch(error => {
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
});
