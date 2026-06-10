const assert = require("assert");

const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:4187";

async function request(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${json.error || text}`);
  }
  return json;
}

async function post(path, body) {
  return request(path, { method: "POST", body: JSON.stringify(body) });
}

async function main() {
  const reminder = await post("/api/medications/remind-later", { id: "med_lisinopril", minutes: 30 });
  assert.equal(reminder.reminder.status, "queued");

  const skipped = await post("/api/medications/skip-dose", { id: "med_lisinopril", reason: "Smoke test skip" });
  assert.equal(skipped.medication.status, "skipped");

  const refill = await post("/api/medications/refill-request", { medicationId: "med_lisinopril", pharmacy: "HealthPlus Pharmacy", deliveryRequested: true });
  assert.equal(refill.refill.status, "requested");

  const booking = await post("/api/bookings", { serviceId: "careride", label: "Ride to Dr. Mehta Clinic", time: "Tomorrow, 10:30 AM" });
  assert.ok(booking.bookings?.[0]?.id || booking.state?.bookings?.[0]?.id, "booking should be persisted");

  const event = await post("/api/events/join", { id: "community_lunch", name: "Community Lunch" });
  assert.ok(event.events?.find?.(item => item.id === "community_lunch")?.joined || event.rsvp, "event RSVP should be persisted");

  const message = await post("/api/messages", { body: "Please ask Rita to check in.", recipient: "rita" });
  assert.ok(message.messages?.[0] || message.message, "message should be persisted");

  console.log("Mobile domain action smoke passed");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
