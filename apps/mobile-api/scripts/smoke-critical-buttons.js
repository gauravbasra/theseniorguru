#!/usr/bin/env node

const apiBase = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "https://mobile-api-nine.vercel.app";

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
    const failure = new Error(json.error || json.message || `HTTP ${response.status}`);
    failure.status = response.status;
    failure.details = json;
    throw failure;
  }
  return { status: response.status, json };
}

function tokenFrom(session) {
  return session.token || session.sessionToken || session.session?.token || session.auth?.token;
}

async function session(email) {
  const result = await request("/api/auth/dev-session", {
    method: "POST",
    body: JSON.stringify({ email })
  });
  const token = tokenFrom(result.json);
  if (!token) throw new Error(`No token returned for ${email}`);
  return token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function step(name, fn) {
  try {
    const result = await fn();
    console.log(`PASS ${name}`);
    return result;
  } catch (error) {
    console.log(`FAIL ${name}: ${error.message}`);
    if (error.details) console.log(JSON.stringify(error.details, null, 2));
    throw error;
  }
}

async function main() {
  console.log(`Critical button smoke: ${apiBase}`);
  const seniorToken = await step("role: senior session", () => session("anita@theseniorguru.local"));
  const businessToken = await step("role: business session", () => session("rohit@careride.local"));
  const circleToken = await step("role: trusted person session", () => session("rita@theseniorguru.local"));
  const adminToken = await step("role: superadmin session", () => session("admin@theseniorguru.local"));

  const seniorState = await step("resident: load Today state", async () => {
    const result = await request("/api/state", { headers: auth(seniorToken) });
    if (!result.json.resident?.id && !result.json.resident?.name) throw new Error("Resident state missing");
    if (!result.json.people?.some(person => person.phone)) throw new Error("Trusted-circle phone numbers missing from resident state");
    return result.json;
  });

  await step("resident: help assistant chat widget", async () => {
    const result = await request("/api/help/chat", {
      method: "POST",
      headers: auth(seniorToken),
      body: JSON.stringify({ message: "I need a ride to my doctor tomorrow." })
    });
    if (!result.json.assistantMessage?.body) throw new Error("Assistant reply missing");
    if (!Array.isArray(result.json.matches)) throw new Error("Assistant matches missing");
    return result.json;
  });

  const smokeMedication = await step("resident: add medication inventory", async () => {
    const result = await request("/api/medications", {
      method: "POST",
      headers: auth(seniorToken),
      body: JSON.stringify({
        name: `Smoke Test Med ${Date.now()}`,
        condition: "Button smoke test",
        strength: "1mg",
        doseQuantity: 1,
        time: "9:00 AM",
        frequency: "Once daily",
        remaining: 99,
        refillThreshold: 5,
        prescriber: "Smoke Test Clinician",
        pharmacy: "Smoke Test Pharmacy"
      })
    });
    if (!result.json.medication?.id) throw new Error("Medication id missing");
    return result.json.medication;
  });

  await step("resident: remind me later button", () => request("/api/medications/remind-later", {
    method: "POST",
    headers: auth(seniorToken),
    body: JSON.stringify({ id: smokeMedication.id, minutes: 30 })
  }));

  await step("resident: skip dose button", () => request("/api/medications/skip-dose", {
    method: "POST",
    headers: auth(seniorToken),
    body: JSON.stringify({ id: smokeMedication.id, reason: "Critical button smoke" })
  }));

  const confirmMedication = await step("resident: add medication for confirmation", async () => {
    const result = await request("/api/medications", {
      method: "POST",
      headers: auth(seniorToken),
      body: JSON.stringify({
        name: `Smoke Confirm Med ${Date.now()}`,
        condition: "Button smoke test",
        strength: "2mg",
        doseQuantity: 1,
        time: "10:00 AM",
        frequency: "Once daily",
        remaining: 99,
        refillThreshold: 5
      })
    });
    return result.json.medication;
  });

  await step("resident: medication taken button", () => request("/api/medications/confirm", {
    method: "POST",
    headers: auth(seniorToken),
    body: JSON.stringify({ id: confirmMedication.id })
  }));

  await step("resident: refill request button", () => request("/api/medications/refill-request", {
    method: "POST",
    headers: auth(seniorToken),
    body: JSON.stringify({ medicationId: smokeMedication.id, notes: "Critical button smoke refill" })
  }));

  await step("resident: SOS button", () => request("/api/safety/voice-sos", {
    method: "POST",
    headers: auth(seniorToken),
    body: JSON.stringify({ command: "Guru, call emergency", confirmed: true, source: "critical-button-smoke" })
  }));

  await step("trusted: accept invite button", () => request("/api/circle/accept-invite", {
    method: "POST",
    headers: auth(circleToken),
    body: JSON.stringify({ inviteCode: "RITA-ANITA" })
  }));

  await step("trusted: ping/chat button", () => request("/api/circle/help-message", {
    method: "POST",
    headers: auth(circleToken),
    body: JSON.stringify({ body: "Critical button smoke trusted check-in." })
  }));

  await step("trusted: standard phone call request button", () => request("/api/circle/call-request", {
    method: "POST",
    headers: auth(circleToken),
    body: JSON.stringify({ channel: "voice", message: "Critical button smoke call request." })
  }));

  await step("business: save onboarding/settings button", () => request("/api/business/onboarding", {
    method: "POST",
    headers: auth(businessToken),
    body: JSON.stringify({
      name: "CareRide",
      contactPerson: "Rohit Mehta",
      email: "rohit@careride.local",
      phone: "(555) 018-2044",
      website: "https://careride.example",
      googleBusinessProfile: "https://business.google.com/careride",
      description: "Critical button smoke profile save.",
      demographics: ["Seniors 65+", "Families coordinating care"],
      serviceAreas: ["Highlands Ranch", "Denver", "Colorado Springs"]
    })
  }));

  await step("business: add service button or billing gate", async () => {
    const result = await request("/api/business/services", {
      method: "POST",
      headers: auth(businessToken),
      body: JSON.stringify({
        name: `Smoke Service ${Date.now()}`,
        category: "Transportation",
        priceLabel: "$35 - $60"
      })
    }, [200, 402, 403]);
    if ([402, 403].includes(result.status) && !/service|billing|approved|plan|payment/i.test(result.json.error || "")) {
      throw new Error(`Unexpected gate: ${result.json.error || result.status}`);
    }
    return result.json;
  });

  await step("business: package free button", () => request("/api/business/plan", {
    method: "PATCH",
    headers: auth(businessToken),
    body: JSON.stringify({ plan: "free" })
  }));

  const service = seniorState.services?.find(item => String(item.category || "").toLowerCase().includes("transport")) || seniorState.services?.[0];
  if (!service?.id) throw new Error("No service available for ride button smoke");
  const pickup = { label: "Highlands Ranch, CO", lat: 39.5447, lng: -104.9673 };
  const dropoff = { label: "Safeway, 9255 S Broadway, Highlands Ranch, CO", lat: 39.5487, lng: -104.9897 };
  const route = await step("ride: preview route button", async () => {
    const result = await request("/api/maps/route-estimate", {
      method: "POST",
      headers: auth(seniorToken),
      body: JSON.stringify({ pickup, dropoff })
    });
    if (!result.json.route?.distanceMeters) throw new Error("Route distance missing");
    return result.json.route;
  });

  await step("ride: price quote button", () => request("/api/rides/pricing-quote", {
    method: "POST",
    headers: auth(seniorToken),
    body: JSON.stringify({ route, provider: "manual_coordination" })
  }));

  const booking = await step("ride: create ride request button", async () => {
    const result = await request("/api/bookings", {
      method: "POST",
      headers: auth(seniorToken),
      body: JSON.stringify({
        serviceId: service.id,
        label: "Smoke ride request",
        time: "Tomorrow, 10:00 AM",
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        pickup,
        dropoff,
        fulfillmentMode: "manual_coordination",
        paymentResponsibility: "senior",
        rideIntake: {
          riderName: "Anita Sharma",
          riderPhone: "+13035550123",
          contactPreference: "call_and_text",
          mobilityAid: "walker",
          accessibilityNeeds: ["walker"],
          needsDoorToDoor: true,
          caregiverRidingAlong: false,
          okToShareWithDriver: true,
          pickupInstructions: "Critical button smoke pickup.",
          dropoffInstructions: "Critical button smoke dropoff.",
          assistanceNotes: "Critical button smoke assistance.",
          medicalSensitivityNotes: "No smoke-sensitive medical notes."
        }
      })
    });
    if (!result.json.booking?.id) throw new Error("Ride booking id missing");
    return result.json.booking;
  });

  await step("ride: refresh status button", () => request(`/api/rides/bookings/${booking.id}/status`, {
    headers: auth(seniorToken)
  }));

  await step("ride: message driver/provider button", () => request(`/api/rides/bookings/${booking.id}/messages`, {
    method: "POST",
    headers: auth(seniorToken),
    body: JSON.stringify({ body: "Critical button smoke ride message.", channel: "driver_note" })
  }));

  await step("superadmin: launch readiness button", async () => {
    const result = await request("/api/superadmin/launch-readiness", { headers: auth(adminToken) });
    if (result.json.launchable !== true) throw new Error("Launch readiness reports blockers");
    return result.json;
  });
}

main().catch(error => {
  console.error(`Critical button smoke failed: ${error.message}`);
  process.exitCode = 1;
});
