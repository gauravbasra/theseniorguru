function taskTitleFromMessage(message) {
  return String(message || "").replace(/^(please\s+)?remind me to/i, "").trim() || String(message || "").trim();
}

function localCacheKey(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

// Find a trust-circle / contact match for a name/relationship mentioned in
// the message. `people` rows look like { id, name, role, phone, permissions, status }.
function matchPerson(normalized, people = []) {
  const relationshipWords = ["daughter", "son", "wife", "husband", "spouse", "mom", "mother", "dad", "father", "sister", "brother", "doctor", "nurse", "caregiver", "neighbor", "friend", "family"];
  // Direct name match (first name or full name)
  for (const person of people) {
    const name = String(person.name || "").trim();
    if (!name) continue;
    const first = name.split(/\s+/)[0].toLowerCase();
    if (first.length > 1 && normalized.includes(first)) return person;
    if (normalized.includes(name.toLowerCase())) return person;
  }
  // Relationship-based match (e.g. "call my daughter")
  for (const word of relationshipWords) {
    if (!normalized.includes(word)) continue;
    const byRole = people.find(p => String(p.role || "").toLowerCase().includes(word) || String(p.relationship || "").toLowerCase().includes(word));
    if (byRole) return byRole;
  }
  return null;
}

// Detect an actionable "call / text / message someone" or "call 911" intent and
// resolve it to a real phone number so the app can place the call/SMS instead of
// just describing how to do it.
function detectContactAction(message, context = {}) {
  const normalized = String(message || "").toLowerCase();
  const people = context.people || [];

  const wantsCall = /\b(call|dial|phone|ring)\b/.test(normalized);
  const wantsText = /\b(text|message|sms|msg)\b/.test(normalized);
  if (!wantsCall && !wantsText) return null;

  // Emergency services always win.
  if (/\b(911|emergency|ambulance|police|fire department)\b/.test(normalized)) {
    return {
      type: "call",
      label: "Emergency – 911",
      phone: "911",
      reply: "I've got the call to 911 ready — tap Call 911 below to connect right now. If you can, stay on the line and tell them where you are."
    };
  }

  const person = matchPerson(normalized, people);
  if (person && person.phone) {
    if (wantsText) {
      return {
        type: "sms",
        label: person.name,
        phone: person.phone,
        body: "",
        reply: `Tap "Text ${person.name}" below and I'll open a message to ${person.phone} for you.`
      };
    }
    return {
      type: "call",
      label: person.name,
      phone: person.phone,
      reply: `Tap "Call ${person.name}" below and I'll dial ${person.phone} for you.`
    };
  }

  // Call/text intent but no matching contact found.
  if (people.length) {
    return {
      type: "contacts",
      reply: `I'm not sure who you mean. Your trusted circle is ${people.slice(0, 4).map(p => p.name).join(", ")} — tell me a name and I can ${wantsText ? "open a message" : "make the call"}.`
    };
  }
  return {
    type: "contacts",
    reply: "I don't have anyone in your trusted circle saved yet. Once a family member or caregiver is added, I can call or text them for you directly."
  };
}

function resolveGuruIntent(message, context = {}) {
  const normalized = String(message || "").toLowerCase();

  const contactAction = detectContactAction(message, context);
  if (contactAction) {
    const { reply, ...action } = contactAction;
    return { intent: "call_action", navigateTo: null, reply, action };
  }

  if (normalized.includes("remind me") || normalized.includes("task")) {
    const title = taskTitleFromMessage(message);
    return { intent: "task", navigateTo: null, reply: `Done. I added this reminder: ${title}`, taskTitle: title };
  }
  if (normalized.includes("medicine") || normalized.includes("medication") || normalized.includes("pill") || normalized.includes("refill")) {
    const due = (context.medications || []).find(item => item.status !== "taken") || (context.medications || [])[0];
    return {
      intent: "medication",
      navigateTo: "residentHome",
      reply: due ? `${due.name} is scheduled for ${due.time}. You can confirm it from Today or ask me to request a refill.` : "I opened Today. You can confirm medication there, or add medications so I can track confirmations and refills."
    };
  }
  if (normalized.includes("pollen") || normalized.includes("weather") || normalized.includes("snow") || normalized.includes("air quality") || normalized.includes("aqi") || normalized.includes("heat")) {
    const guidance = context.contextIntelligence?.guidanceItems || [];
    const environmentGuidance = guidance.find(item => ["environment", "transportation", "health"].includes(item.domain));
    return {
      intent: "environment",
      navigateTo: "residentHome",
      reply: environmentGuidance
        ? `${environmentGuidance.title}. ${environmentGuidance.body || ""}`.trim()
        : "I checked today's context. I can watch pollen, air quality, heat, snow, and travel risk for you."
    };
  }
  if (normalized.includes("risk") || normalized.includes("am i okay") || normalized.includes("okay") || normalized.includes("status")) {
    const status = context.dailyStatus?.status || context.contextIntelligence?.dailyStatus || "stable";
    return {
      intent: "daily_status",
      navigateTo: "residentHome",
      reply: `Today's status is ${String(status).replace(/_/g, " ")}. I am checking health, mobility, environment, social contact, medication, and safety signals.`
    };
  }
  if (normalized.includes("ride") || normalized.includes("doctor") || normalized.includes("transport")) return { intent: "ride", navigateTo: "residentHelp", reply: "I opened Help. Tell me pickup, destination, and time, and I will match transportation options." };
  if (normalized.includes("lonely") || normalized.includes("talk") || normalized.includes("companion")) return { intent: "companion", navigateTo: "residentPeople", reply: "I am here with you. I can chat, help call your trusted circle, or find an activity nearby." };
  if (normalized.includes("family") || normalized.includes("rita") || normalized.includes("daughter") || normalized.includes("call her")) return { intent: "family", navigateTo: "residentPeople", reply: "I can help you check in with your family or trusted circle." };
  if (normalized.includes("safe zone") || normalized.includes("where am i") || normalized.includes("location")) return { intent: "location", navigateTo: "residentSafety", reply: "I can check location and safe-zone context from the Safety screen." };
  if (normalized.includes("health summary") || normalized.includes("why am i watch") || normalized.includes("why am i stable")) return { intent: "health_summary", navigateTo: "residentHome", reply: "I can explain today's health status from your existing Guru scores." };
  if (normalized.includes("food") || normalized.includes("meal") || normalized.includes("grocery") || normalized.includes("diaper") || normalized.includes("clean")) return { intent: "services", navigateTo: "residentServices", reply: "I opened Services. I can help find food, essentials, cleaning, laundry, or other local support." };
  if (normalized.includes("sos") || normalized.includes("emergency") || normalized.includes("fall") || normalized.includes("unsafe")) return { intent: "safety", navigateTo: "residentSafety", reply: "I opened Safety. If this is urgent, press SOS now or call emergency services." };
  if (normalized.includes("remember") || normalized.includes("who is") || normalized.includes("birthday")) {
    const remembered = (context.memories || []).slice(0, 3).map(item => item.value || item.title).filter(Boolean).join("; ");
    return { intent: "memory", navigateTo: null, reply: remembered ? `Here is what I remember: ${remembered}` : "I can remember family, birthdays, doctors, routines, and preferences. Tell me what to save." };
  }
  if (normalized.includes("calendar") || normalized.includes("appointment") || normalized.includes("schedule")) {
    const events = context.calendarEvents || [];
    return { intent: "calendar", navigateTo: null, reply: events.length ? `Your next item is ${events[0].title} at ${events[0].startsAt}.` : "I can add appointments, family calls, activities, and reminders to your calendar list." };
  }
  if (normalized.includes("story")) {
    const memory = (context.memories || []).find(item => /family|preference|place/.test(String(item.category || "")));
    return { intent: "story", navigateTo: null, reply: memory ? `Here is a short story inspired by what I remember: ${memory.value}. A calm afternoon unfolded with familiar music, gentle light, and support close by.` : "Here is a short story: A gentle morning began with warm tea, a favorite song, and a call from someone who remembered every detail that mattered." };
  }
  if (normalized.includes("music") || normalized.includes("song")) return { intent: "music", navigateTo: null, reply: "I can help open music. Try old Hindi songs, relaxing music, devotional music, or Elvis." };
  if (normalized.includes("scan") || normalized.includes("camera") || normalized.includes("product")) return { intent: "scan", navigateTo: null, reply: "Use Scan to capture a medicine bottle, product label, QR code, or document. I will prepare the next action." };
  return { intent: "general", navigateTo: null, reply: "I can help with medication, rides, services, loneliness, tasks, stories, music, scanning, or safety." };
}

function isRoutineGuruIntent(intent) {
  return [
    "call_action",
    "task",
    "medication",
    "ride",
    "companion",
    "services",
    "safety",
    "memory",
    "calendar",
    "music",
    "scan",
    "environment",
    "daily_status",
    "family",
    "location",
    "health_summary"
  ].includes(intent);
}

module.exports = { resolveGuruIntent, taskTitleFromMessage, isRoutineGuruIntent, localCacheKey };
