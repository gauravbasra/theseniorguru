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
    error.status = response.status;
    error.details = json;
    throw error;
  }
  return json;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function saveStep(token, step, stepKey, data = {}, skipped = false) {
  return request("/api/onboarding/senior/step", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ step, stepKey, data, skipped })
  });
}

async function main() {
  console.log(`Senior onboarding v2 smoke: ${apiBase}`);
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const email = `senior-v2-${nonce}@example.com`;
  const password = `StrongPass-${nonce}`;

  const registered = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      fullName: "Anita Sharma",
      gender: "female",
      phone: "+13035550101",
      email,
      password,
      confirmPassword: password
    })
  });
  assert.ok(registered.token, "register must return token");
  assert.equal(registered.nextStep, "choose_role");
  assert.equal(registered.onboarding_status.roleSelected, false);

  const role = await request("/api/auth/select-role", {
    method: "POST",
    headers: auth(registered.token),
    body: JSON.stringify({ role: "senior" })
  });
  assert.equal(role.user.role, "senior", "role selection must set senior");
  assert.equal(role.nextStep, "senior_onboarding");
  assert.equal(role.onboarding_status.roleSelected, true);
  assert.equal(role.onboarding_status.isOnboarded, false);

  const duplicateRole = await request("/api/auth/select-role", {
    method: "POST",
    headers: auth(registered.token),
    body: JSON.stringify({ role: "business" })
  }, [409]);
  assert.match(duplicateRole.error || "", /already/i, "role cannot be selected twice");

  const initialStatus = await request("/api/onboarding/senior/status", { headers: auth(registered.token) });
  assert.equal(initialStatus.currentStep, 1);
  assert.equal(initialStatus.currentStepKey, "welcome");

  await saveStep(registered.token, 1, "welcome");
  await saveStep(registered.token, 2, "photo", { profilePhotoEvidenceId: null });
  await saveStep(registered.token, 3, "verify", { livenessEvidenceId: null, verificationStatus: "pending" });
  await saveStep(registered.token, 4, "basic_info", {
    name: "Anita Sharma",
    preferredName: "Anita",
    phone: "+13035550101",
    email,
    dob: "1958-04-15",
    livingType: "senior_community"
  });

  const resume = await request("/api/onboarding/senior/status", { headers: auth(registered.token) });
  assert.equal(resume.currentStep, 5, "after step 4, resume should continue to address");
  assert.equal(resume.currentStepKey, "address");
  assert.equal(resume.resumeScreen, "seniorAddress");

  await saveStep(registered.token, 5, "address", {
    homeAddress: "123 Greenview Dr, Sunnyvale, CA 94086",
    community: "Park View Community",
    preferredHospital: "City Care Hospital"
  });
  await saveStep(registered.token, 6, "health_snapshot", {
    healthConcerns: ["heart_condition", "high_blood_pressure"],
    mobilityNotes: "Uses walker for longer distances",
    cognitiveNotes: "Memory reminders helpful"
  });
  await saveStep(registered.token, 7, "medications", {}, true);
  await saveStep(registered.token, 8, "connected_devices", {}, true);
  await saveStep(registered.token, 9, "permissions", {
    devicePermissions: ["location", "notifications"],
    locationSharing: true,
    notificationsEnabled: true
  });
  await saveStep(registered.token, 10, "music", {}, true);
  await saveStep(registered.token, 11, "trust_circle", { contacts: [] });
  await saveStep(registered.token, 12, "privacy_controls", {
    dailyCheckins: true,
    medications: true,
    appointments: true,
    locationHistory: false,
    healthAnalytics: true
  });
  await saveStep(registered.token, 13, "sos_setup", {
    sosOrder: [
      { type: "emergency", label: "911", priority: 1 }
    ]
  });
  await saveStep(registered.token, 14, "daily_routine", {
    routineToggles: {
      emergencyAlerts: true,
      medicationAlerts: true,
      appointments: true,
      location: false,
      healthData: true,
      dailyCheckins: true
    }
  });

  const completed = await request("/api/onboarding/senior", {
    method: "POST",
    headers: auth(registered.token),
    body: JSON.stringify({})
  });
  assert.ok(completed.onboarding?.session?.id, "final submit must return session");
  assert.equal(completed.onboarding_status.isOnboarded, true, "final submit should mark onboarded");
  assert.equal(completed.nextStep, "home");

  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  });
  assert.equal(login.onboarding_status.isOnboarded, true, "login must report completed onboarding");
  assert.equal(login.nextStep, "home");

  const me = await request("/api/me", { headers: auth(login.token) });
  assert.equal(me.onboarding_status.isOnboarded, true, "/api/me must include completed onboarding status");

  console.log("Senior onboarding v2 smoke passed");
}

main().catch(error => {
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
});
