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

function resolveGuruIntent(message, context = {}) {
  const normalized = String(message || "").toLowerCase();
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
    "task",
    "medication",
    "ride",
    "companion",
    "services",
    "safety",
    "memory",
    "calendar",
    "story",
    "music",
    "scan",
    "environment",
    "daily_status"
  ].includes(intent);
}

module.exports = { resolveGuruIntent, taskTitleFromMessage, isRoutineGuruIntent, localCacheKey };
