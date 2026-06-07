#!/usr/bin/env node

const assert = require("assert");

const apiBase = process.env.API_BASE_URL || process.env.EXPO_PUBLIC_API_BASE_URL || "http://127.0.0.1:4187";

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

async function main() {
  console.log(`Flutter resident contract smoke: ${apiBase}`);
  const session = await request("/api/auth/device-session", {
    method: "POST",
    body: JSON.stringify({ installationId: `flutter-smoke-${Date.now()}`, role: "senior" })
  });
  const token = session.token;
  assert.ok(token, "device session must return token");

  const initialState = await request("/api/state", { headers: auth(token) });
  assert.ok(initialState.resident?.id || initialState.resident?.name, "resident state must load");
  assert.ok(Array.isArray(initialState.services), "services must be readable for Services screen");
  assert.ok(Array.isArray(initialState.medications), "medications must be readable for Medication screens");

  const med = await request("/api/medications", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      name: `Flutter Smoke Med ${Date.now()}`,
      condition: "Flutter screen contract",
      strength: "5mg",
      doseQuantity: 1,
      time: "8:00 AM",
      frequency: "Once daily",
      remaining: 6,
      refillThreshold: 5,
      pharmacy: "HealthPlus Pharmacy"
    })
  });
  assert.ok(med.medication?.id, "medication add must write a row");

  const confirmed = await request("/api/medications/confirm", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ id: med.medication.id })
  });
  assert.equal(confirmed.medication.status, "taken", "confirm medication must persist taken status");

  const refill = await request("/api/medications/refill-request", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ medicationId: med.medication.id, notes: "Flutter screen contract" })
  });
  assert.ok(refill.refillRequest?.id || refill.refill?.id, "refill request must write a row");

  const guru = await request("/api/guru/chat", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ message: "I need a ride tomorrow", screen: "flutter-guru" })
  });
  assert.ok(guru.reply, "Guru screen must return assistant reply");

  const refreshedState = await request("/api/state", { headers: auth(token) });
  const service = refreshedState.services.find(service => String(service.category || "").toLowerCase().includes("transport")) || refreshedState.services[0];
  assert.ok(service?.id, "ride/services screen needs a service id");

  const booking = await request("/api/bookings", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      serviceId: service.id,
      label: "Flutter Cardiology Visit",
      time: "Tomorrow, 10:00 AM",
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      pickup: { label: "Park View Community", lat: 39.5447, lng: -104.9673 },
      dropoff: { label: "Dr. Mehta Clinic", lat: 39.5487, lng: -104.9897 },
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
        okToShareWithDriver: true
      }
    })
  });
  const bookingId = booking.booking?.id || booking.bookings?.[0]?.id;
  assert.ok(bookingId, "ride booking must write a booking row");

  const event = await request("/api/events/join", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ id: "chair_yoga", name: "Chair Yoga" })
  });
  assert.ok(event.rsvp?.id || event.events?.some?.(item => item.id === "chair_yoga"), "event join must persist RSVP");

  const post = await request("/api/posts", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ body: "Flutter contract post", audience: "community" })
  });
  assert.ok(post.post?.id, "feed create post must persist community post");

  await request("/api/health/consent", {
    method: "PATCH",
    headers: auth(token),
    body: JSON.stringify({ granted: true, source: "flutter-health-connect", dataTypes: ["heartRate", "hrv", "sleep", "steps"] })
  });
  const vitals = await request("/api/health/vitals", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      source: "flutter-health-connect",
      readings: [{ heartRate: 72, hrv: 48, sleepMinutes: 434, stepsToday: 4280 }]
    })
  });
  assert.ok(vitals.healthVitals?.readings?.length, "health/vitals screen must write readings");

  const sos = await request("/api/safety/voice-sos", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ command: "Guru, call emergency", confirmed: true, source: "flutter-resident-contract" })
  });
  assert.ok(sos.sosEvent?.id, "Safety screen must create SOS event");

  const finalState = await request("/api/state", { headers: auth(token) });
  assert.ok(finalState.medications?.some(item => item.id === med.medication.id), "final state must read written medication");
  assert.ok(finalState.bookings?.some(item => item.id === bookingId), "final state must read written booking");

  console.log("Flutter resident contract smoke passed");
}

main().catch(error => {
  console.error(error.message);
  if (error.details) console.error(JSON.stringify(error.details, null, 2));
  process.exit(1);
});
