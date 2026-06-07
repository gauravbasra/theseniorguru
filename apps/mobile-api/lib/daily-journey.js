function buildDailyJourney(state = {}) {
  const med = (state.medications || [])[0] || { name: "Morning medication", time: "8:00 AM", remaining: 12 };
  const event = (state.events || [])[0] || { title: "Morning stretch", time: "10:30 AM" };
  const message = (state.circleMessages || [])[0] || { trusted_name: "Rita", body: "Good morning" };
  return {
    resident: state.resident?.name || "Anita Sharma",
    sections: [
      { period: "Morning", priority: "medication", title: med.name, subtitle: `${med.time || "8:00 AM"} · ${med.remaining ?? ""} remaining`, action: "confirm_medication" },
      { period: "Afternoon", priority: "support", title: "Ask Guru for help", subtitle: "Ride, food, cleaning, diapers, medication, or companionship", action: "open_guru" },
      { period: "Evening", priority: "connection", title: `Check in with ${message.trusted_name || "trusted circle"}`, subtitle: message.body || "Family connection", action: "open_circle" },
      { period: "Today", priority: "activity", title: event.title, subtitle: event.time || event.startsAt || "Today", action: "open_events" }
    ],
    generatedAt: new Date().toISOString()
  };
}
module.exports = { buildDailyJourney };
