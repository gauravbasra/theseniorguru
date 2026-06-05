const http = require("http");
const fs = require("fs");
const path = require("path");
let productionApi = null;
if (process.env.DATABASE_URL) {
  const { Pool } = require("pg");
  const { createProductionApi } = require("./production-server");
  productionApi = createProductionApi(new Pool({ connectionString: process.env.DATABASE_URL }));
}

const root = __dirname;
const publicDir = path.join(root, "public");
const dataFile = path.join(root, "data", "state.json");
const port = Number(process.env.PORT || 4187);
let runtimeState = null;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function readState() {
  if (process.env.VERCEL) {
    if (!runtimeState) runtimeState = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return runtimeState;
  }
  return JSON.parse(fs.readFileSync(dataFile, "utf8"));
}

function writeState(state) {
  if (process.env.VERCEL) {
    runtimeState = state;
    return;
  }
  fs.writeFileSync(dataFile, JSON.stringify(state, null, 2));
}

function normalizeMedication(payload, existing = {}) {
  const name = String(payload.name || existing.name || "").trim();
  const condition = String(payload.condition || existing.condition || "").trim();
  const strength = String(payload.strength || existing.strength || "").trim();
  const time = String(payload.time || existing.time || "").trim();
  if (!name || !condition || !strength || !time) {
    const missing = [];
    if (!name) missing.push("name");
    if (!condition) missing.push("condition");
    if (!strength) missing.push("strength");
    if (!time) missing.push("time");
    return {error: `Missing medication fields: ${missing.join(", ")}`};
  }
  return {
    id: payload.id || existing.id || `med_${Date.now()}`,
    name,
    condition,
    strength,
    doseQuantity: Math.max(1, Number(payload.doseQuantity || existing.doseQuantity || 1)),
    time,
    frequency: String(payload.frequency || existing.frequency || "Once daily").trim(),
    remaining: Math.max(0, Number(payload.remaining ?? existing.remaining ?? 0)),
    refillThreshold: Math.max(0, Number(payload.refillThreshold ?? existing.refillThreshold ?? 5)),
    prescriber: String(payload.prescriber || existing.prescriber || "").trim(),
    pharmacy: String(payload.pharmacy || existing.pharmacy || "").trim(),
    status: payload.status || existing.status || "pending",
    lastConfirmedAt: existing.lastConfirmedAt || null
  };
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
  });
  res.end(JSON.stringify(body));
}

function body(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => raw += chunk);
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (error) { reject(error); }
    });
  });
}

function scoreServices(state, need) {
  const text = need.toLowerCase();
  const category = text.includes("ride") || text.includes("doctor") || text.includes("hospital")
    ? "Transportation"
    : text.includes("medicine") || text.includes("medication") || text.includes("refill")
      ? "Medicine Delivery"
      : "Transportation";

  return state.services
    .filter(service => service.category === category)
    .map(service => ({
      ...service,
      score: Math.round((service.rating * 18) + (service.eta.includes("tomorrow") ? 9 : 4))
    }))
    .sort((a, b) => b.score - a.score);
}

function businessServices(state) {
  return state.services.filter(service => service.provider === state.business.name);
}

function planEntitlement(business) {
  if (business.plan === "paid") {
    return {
      name: "$100/month Growth",
      serviceLimit: Infinity,
      leadAllowance: business.leadQuota.paidPerMonth + business.leadQuota.topUps,
      leadWindow: "month",
      used: business.leadQuota.usedThisMonth
    };
  }
  return {
    name: "Free",
    serviceLimit: 1,
    leadAllowance: business.leadQuota.freePerYear,
    leadWindow: "year",
    used: business.leadQuota.usedThisYear
  };
}

function circleView(state, personId) {
  const person = state.people.find(item => item.id === personId) || state.people[0];
  const permissions = new Set(person.permissions || []);
  const healthVitals = ensureHealthVitals(state);
  const wearables = ensureWearables(state);
  const notifications = ensureNotificationQueue(state);
  return {
    person,
    resident: {
      name: state.resident.name,
      community: state.resident.community,
      mood: permissions.has("wellness") ? state.resident.mood : "Hidden"
    },
    permissions: person.permissions || [],
    medications: permissions.has("medications") ? state.medications.map(med => ({
      id: med.id,
      name: med.name,
      time: med.time,
      status: med.status,
      remaining: med.remaining
    })) : [],
    bookings: permissions.has("rides") ? state.bookings.map(booking => ({
      id: booking.id,
      service: booking.service,
      time: booking.time,
      status: booking.status,
      provider: booking.provider
    })) : [],
    requests: permissions.has("rides") ? state.requests.map(request => ({
      id: request.id,
      type: request.type,
      time: request.time,
      status: request.status
    })) : [],
    messages: permissions.has("messages") ? state.messages.slice(0, 5) : [],
    sosContacts: permissions.has("sos") ? state.resident.sosContacts : [],
    safety: permissions.has("safety") || permissions.has("sos") ? state.safety : null,
    healthVitals: permissions.has("wellness") || permissions.has("safety") ? healthVitals : null,
    wearables: permissions.has("safety") || permissions.has("sos") ? wearables : null,
    notifications: permissions.has("sos") || permissions.has("safety") ? notifications.filter(item => item.personId === person.id).slice(0, 20) : [],
    tasks: state.circleTasks.filter(task => task.assignedTo === person.id)
  };
}

function healthRiskContext(profile = {}) {
  const text = JSON.stringify(profile).toLowerCase();
  return {
    fallThreshold: text.includes("fall-risk") || text.includes("walker") || text.includes("standby assist") || text.includes("falls in last") ? 0.7 : 0.82,
    stillnessThreshold: text.includes("transfer") || text.includes("standby assist") || text.includes("parkinson") ? 30 : 45,
    wanderingSensitive: text.includes("wandering") && !text.includes("wandering risk\":\"low"),
    fallContext: profile.mobilityProfile?.transferSupport || profile.mobilityProfile?.fallHistory || "",
    memoryContext: profile.memoryProfile?.reassuranceStyle || "",
    emergencyContext: profile.carePreferences?.emergencyInstructions || ""
  };
}

function evaluateSafety(state, payload) {
  const safety = state.safety;
  const events = [];
  const risk = healthRiskContext(state.resident.healthProfile);
  const confidence = Number(payload.fallConfidence ?? safety.fallDetection.confidence ?? 0);
  const stillMinutes = Number(payload.stillMinutes ?? safety.movement.stillMinutes ?? 0);
  const outsideSafeZone = payload.safeZoneStatus === "outside";
  const impactDetected = Boolean(payload.impactDetected);

  if (impactDetected && confidence >= risk.fallThreshold) {
    events.push({
      type: "fall-detected",
      severity: "critical",
      body: `Likely fall detected with ${Math.round(confidence * 100)}% confidence. Health profile notes: ${risk.fallContext || "fall-risk support should be reviewed"}. Immediate SOS notification triggered.`
    });
  }

  if (outsideSafeZone) {
    events.push({
      type: "safe-zone-exit",
      severity: risk.wanderingSensitive ? "critical" : "high",
      body: `Resident appears outside the approved safe zone.${risk.wanderingSensitive ? ` Memory profile guidance: ${risk.memoryContext || "use calm redirection and notify trusted circle"}.` : ""} Trusted circle notification triggered.`
    });
  }

  if (stillMinutes >= risk.stillnessThreshold) {
    events.push({
      type: "unusual-stillness",
      severity: "high",
      body: `Phone analytics show ${stillMinutes} minutes of unusual stillness. Mobility profile threshold is ${risk.stillnessThreshold} minutes. Trusted circle notification triggered.`
    });
  }

  for (const event of events) {
    const sosEvent = {
      id: `sos_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      location: safety.location,
      status: "active",
      notified: state.people.filter(person => (person.permissions || []).includes("sos") || (person.permissions || []).includes("safety")).map(person => person.name),
      ...event
    };
    safety.sosEvents.unshift(sosEvent);
    state.messages.unshift({from: "Safety Monitor", body: sosEvent.body});
    for (const person of state.people.filter(item => (item.permissions || []).includes("safety") || (item.permissions || []).includes("sos"))) {
      state.circleTasks.unshift({
        id: `circle_task_${Date.now()}_${person.id}`,
        assignedTo: person.id,
        resident: state.resident.name,
        type: event.type,
        body: sosEvent.body,
        status: "open"
      });
    }
  }
}

function emergencyContacts(state) {
  return state.people.filter(person => (person.permissions || []).includes("sos") || (person.permissions || []).includes("safety"));
}

function createSosEvent(state, event) {
  const safety = state.safety;
  const sosEvent = {
    id: `sos_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    location: safety.location,
    status: "active",
    notified: emergencyContacts(state).map(person => person.name),
    ...event
  };
  safety.sosEvents.unshift(sosEvent);
  addAuditLog(state, {
    action: "sos_event_created",
    entityType: "sos_event",
    entityId: sosEvent.id,
    severity: sosEvent.severity,
    actor: event.source || "safety-system",
    details: `${sosEvent.type}: ${sosEvent.body}`
  });
  enqueueSafetyNotifications(state, sosEvent);
  state.messages.unshift({from: "Safety Monitor", body: sosEvent.body});
  for (const person of emergencyContacts(state)) {
    state.circleTasks.unshift({
      id: `circle_task_${Date.now()}_${person.id}`,
      assignedTo: person.id,
      resident: state.resident.name,
      type: event.type,
      body: sosEvent.body,
      status: "open"
    });
  }
  return sosEvent;
}

function ensureAuditLogs(state) {
  if (!state.auditLogs) state.auditLogs = [];
  return state.auditLogs;
}

function addAuditLog(state, entry) {
  const logs = ensureAuditLogs(state);
  const log = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    action: entry.action,
    entityType: entry.entityType || "system",
    entityId: entry.entityId || null,
    severity: entry.severity || "info",
    actor: entry.actor || "system",
    details: entry.details || ""
  };
  logs.unshift(log);
  return log;
}

function ensureNotificationQueue(state) {
  if (!state.notificationQueue) state.notificationQueue = [];
  return state.notificationQueue;
}

function notificationChannelsFor(event) {
  if (event.severity === "critical") return ["push", "sms", "call"];
  if (event.severity === "high") return ["push", "sms"];
  return ["push"];
}

function enqueueSafetyNotifications(state, event) {
  const queue = ensureNotificationQueue(state);
  const channels = notificationChannelsFor(event);
  for (const person of emergencyContacts(state)) {
    for (const channel of channels) {
      queue.unshift({
        id: `notif_${Date.now()}_${person.id}_${channel}_${Math.random().toString(36).slice(2, 6)}`,
        eventId: event.id,
        personId: person.id,
        personName: person.name,
        channel,
        status: "queued",
        severity: event.severity,
        eventType: event.type,
        body: event.body,
        createdAt: new Date().toISOString(),
        deliveredAt: null
      });
    }
  }
  return queue;
}

function deliverNotification(notification) {
  const providerByChannel = {
    push: process.env.PUSH_PROVIDER || "expo-push-simulator",
    sms: process.env.SMS_PROVIDER || "twilio-sms-simulator",
    call: process.env.CALL_PROVIDER || "twilio-voice-simulator"
  };
  const provider = providerByChannel[notification.channel] || "unknown-provider";
  return {
    status: "delivered",
    provider,
    providerMessageId: `${provider}_${notification.id}_${Date.now()}`,
    deliveredAt: new Date().toISOString()
  };
}

function processNotificationQueue(state, limit = 10) {
  const queue = ensureNotificationQueue(state);
  const pending = queue.filter(item => item.status === "queued").slice(0, Math.max(1, Number(limit || 10)));
  const delivered = [];
  for (const notification of pending) {
    const result = deliverNotification(notification);
    notification.status = result.status;
    notification.provider = result.provider;
    notification.providerMessageId = result.providerMessageId;
    notification.deliveredAt = result.deliveredAt;
    delivered.push(notification);
  }
  return delivered;
}

function ensureHealthVitals(state) {
  if (!state.healthVitals) {
    state.healthVitals = {
      lastSyncedAt: null,
      source: "not-synced",
      readings: [],
      summary: {
        heartRateAvg: null,
        oxygenAvg: null,
        respiratoryRateAvg: null,
        hrvAvg: null,
        sleepMinutes: null,
        caloriesToday: null,
        stepsToday: null,
        riskLevel: "unknown",
        riskReasons: []
      }
    };
  }
  return state.healthVitals;
}

function ensureHealthConsent(state) {
  if (!state.healthConsent) {
    state.healthConsent = {
      residentId: state.resident.id,
      granted: false,
      source: null,
      dataTypes: [],
      updatedAt: null
    };
  }
  return state.healthConsent;
}

function healthReadingDataTypes(reading) {
  const types = [];
  if (reading.heartRate !== undefined) types.push("heartRate");
  if (reading.oxygenSaturation !== undefined) types.push("oxygenSaturation");
  if (reading.respiratoryRate !== undefined) types.push("respiratoryRate");
  if (reading.hrv !== undefined) types.push("hrv");
  if (reading.sleepMinutes !== undefined) types.push("sleep");
  if (reading.caloriesToday !== undefined) types.push("calories");
  if (reading.stepsToday !== undefined) types.push("steps");
  return types;
}

function ensureWearables(state) {
  if (!state.wearables) {
    state.wearables = {
      lastSyncedAt: null,
      devices: [],
      proximity: {
        currentZone: "unknown",
        distanceMeters: null,
        safe: true,
        lastSeenAt: null
      },
      latestSummary: {
        connectedCount: 0,
        lowBatteryCount: 0,
        sosPressed: false,
        fallDetected: false,
        proximityRisk: "unknown",
        riskLevel: "unknown",
        riskReasons: []
      }
    };
  }
  return state.wearables;
}

function evaluateWearables(devices, proximity) {
  const summary = {
    connectedCount: devices.filter(device => device.status === "connected").length,
    lowBatteryCount: devices.filter(device => Number(device.batteryPercent) <= 20).length,
    sosPressed: devices.some(device => device.sosPressed === true),
    fallDetected: devices.some(device => Number(device.fallConfidence || 0) >= 0.82),
    proximityRisk: proximity.safe === false || Number(proximity.distanceMeters || 0) > 40 ? "watch" : "low",
    riskLevel: "low",
    riskReasons: []
  };
  if (summary.lowBatteryCount) summary.riskReasons.push("wearable-low-battery");
  if (summary.sosPressed) summary.riskReasons.push("wearable-sos-pressed");
  if (summary.fallDetected) summary.riskReasons.push("wearable-fall-detected");
  if (summary.proximityRisk === "watch") summary.riskReasons.push("proximity-out-of-range");
  if (summary.sosPressed || summary.fallDetected) summary.riskLevel = "high";
  else if (summary.riskReasons.length) summary.riskLevel = "watch";
  return summary;
}

function average(values) {
  const numeric = values.filter(value => Number.isFinite(Number(value))).map(Number);
  if (!numeric.length) return null;
  return Math.round(numeric.reduce((sum, value) => sum + value, 0) / numeric.length);
}

function evaluateHealthVitals(readings) {
  const summary = {
    heartRateAvg: average(readings.map(item => item.heartRate)),
    oxygenAvg: average(readings.map(item => item.oxygenSaturation)),
    respiratoryRateAvg: average(readings.map(item => item.respiratoryRate)),
    hrvAvg: average(readings.map(item => item.hrv)),
    sleepMinutes: average(readings.map(item => item.sleepMinutes)),
    caloriesToday: average(readings.map(item => item.caloriesToday)),
    stepsToday: average(readings.map(item => item.stepsToday)),
    riskLevel: "low",
    riskReasons: []
  };
  if (summary.oxygenAvg !== null && summary.oxygenAvg < 92) summary.riskReasons.push("oxygen-below-92");
  if (summary.heartRateAvg !== null && (summary.heartRateAvg > 115 || summary.heartRateAvg < 45)) summary.riskReasons.push("heart-rate-out-of-range");
  if (summary.respiratoryRateAvg !== null && (summary.respiratoryRateAvg > 24 || summary.respiratoryRateAvg < 9)) summary.riskReasons.push("respiratory-rate-out-of-range");
  if (summary.sleepMinutes !== null && summary.sleepMinutes < 240) summary.riskReasons.push("low-sleep-duration");
  if (summary.riskReasons.length >= 2) summary.riskLevel = "high";
  else if (summary.riskReasons.length === 1) summary.riskLevel = "watch";
  return summary;
}

function classifyVoiceSosCommand(command) {
  const normalized = String(command || "").toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.includes("call emergency") || normalized.includes("call 911") || normalized.includes("emergency now")) {
    return {
      route: "911-and-trusted-circle",
      emergencyNumber: "911",
      type: "voice-sos-911",
      severity: "critical",
      label: "Guru, call emergency"
    };
  }
  if (normalized.includes("ambulance") || normalized.includes("need medical help")) {
    return {
      route: "ambulance-and-trusted-circle",
      emergencyNumber: "911",
      type: "voice-sos-ambulance",
      severity: "critical",
      label: "Guru, I need an ambulance"
    };
  }
  if (normalized.includes("call rita") || normalized.includes("call my daughter") || normalized.includes("call trusted")) {
    return {
      route: "trusted-circle-first",
      emergencyNumber: null,
      type: "voice-sos-trusted-circle",
      severity: "high",
      label: "Guru, call Rita now"
    };
  }
  return null;
}

function routeApi(req, res) {
  return body(req).then(payload => {
    if (productionApi) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      return productionApi.route(req, payload, url)
        .then(result => send(res, 200, result))
        .catch(error => send(res, error.status || 500, {error: error.message}));
    }
    const state = readState();
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/api/state") {
      ensureHealthVitals(state);
      ensureHealthConsent(state);
      ensureWearables(state);
      ensureNotificationQueue(state);
      ensureAuditLogs(state);
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "GET" && url.pathname === "/api/superadmin/audit-logs") {
      return send(res, 200, {logs: ensureAuditLogs(state).slice(0, 100)});
    }

    if (req.method === "GET" && url.pathname === "/api/superadmin/approvals") {
      const businessStatus = state.business.status || "pending";
      const businesses = businessStatus === "approved" ? [] : [{
        id: state.business.id || "business_primary",
        name: state.business.name,
        email: state.business.email,
        status: businessStatus,
        serviceAreas: state.business.serviceAreas || [],
        plan: state.business.plan || "free"
      }];
      const services = state.services
        .filter(service => (service.status || "pending") !== "approved")
        .map(service => ({...service, status: service.status || "pending"}));
      return send(res, 200, {businesses, services});
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/superadmin\/businesses\/[^/]+\/approve$/)) {
      state.business.status = "approved";
      state.business.approvedAt = new Date().toISOString();
      state.business.approvalNotes = payload.notes || "Approved from mobile superadmin.";
      addAuditLog(state, {
        action: "business_approved",
        entityType: "business",
        severity: "info",
        actor: "superadmin",
        details: `${state.business.name} approved. ${state.business.approvalNotes}`
      });
      writeState(state);
      return send(res, 200, {business: state.business});
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/superadmin\/businesses\/[^/]+\/reject$/)) {
      state.business.status = "rejected";
      state.business.rejectedAt = new Date().toISOString();
      state.business.rejectionNotes = payload.notes || "Rejected from mobile superadmin.";
      addAuditLog(state, {
        action: "business_rejected",
        entityType: "business",
        severity: "high",
        actor: "superadmin",
        details: `${state.business.name} rejected. ${state.business.rejectionNotes}`
      });
      writeState(state);
      return send(res, 200, {business: state.business});
    }

    if (req.method === "POST" && url.pathname.match(/^\/api\/superadmin\/services\/[^/]+\/approve$/)) {
      const serviceId = url.pathname.split("/")[4];
      const service = state.services.find(item => item.id === serviceId);
      if (!service) return send(res, 404, {error: "Service not found"});
      service.status = "approved";
      service.approvedAt = new Date().toISOString();
      service.approvalNotes = payload.notes || "Approved from mobile superadmin.";
      addAuditLog(state, {
        action: "service_approved",
        entityType: "service",
        severity: "info",
        actor: "superadmin",
        details: `${service.name} approved. ${service.approvalNotes}`
      });
      writeState(state);
      return send(res, 200, {service});
    }

    if (req.method === "PATCH" && url.pathname === "/api/resident") {
      const healthProfile = payload.healthProfile ? {
        ...state.resident.healthProfile,
        ...payload.healthProfile,
        updatedAt: new Date().toISOString()
      } : state.resident.healthProfile;
      state.resident = {
        ...state.resident,
        ...payload,
        age: payload.age ? Number(payload.age) : state.resident.age,
        sosContacts: Array.isArray(payload.sosContacts) ? payload.sosContacts : String(payload.sosContacts || state.resident.sosContacts.join(",")).split(",").map(item => item.trim()).filter(Boolean),
        healthProfile
      };
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "POST" && url.pathname === "/api/medications") {
      state.medications = state.medications || [];
      const existingIndex = state.medications.findIndex(item => item.id === payload.id);
      const medication = normalizeMedication(payload, existingIndex >= 0 ? state.medications[existingIndex] : {});
      if (medication.error) return send(res, 400, {error: medication.error});
      if (existingIndex >= 0) state.medications[existingIndex] = medication;
      else state.medications.push(medication);
      ensureAuditLogs(state).unshift({
        id: `audit_${Date.now()}`,
        createdAt: new Date().toISOString(),
        action: existingIndex >= 0 ? "medication_inventory_updated" : "medication_inventory_created",
        entityType: "medication",
        entityId: medication.id,
        severity: "info",
        actor: state.resident.name,
        details: `${medication.name} ${medication.strength} scheduled ${medication.frequency} at ${medication.time}; ${medication.remaining} remaining.`
      });
      writeState(state);
      return send(res, existingIndex >= 0 ? 200 : 201, {medication});
    }

    if (req.method === "POST" && url.pathname === "/api/resident/complete") {
      const required = ["name", "age", "community"];
      const missing = required.filter(field => !state.resident[field]);
      if (!state.resident.sosContacts.length) missing.push("sosContacts");
      if (!state.resident.healthProfile?.primaryCondition?.name) missing.push("healthProfile.primaryCondition");
      if (!state.resident.healthProfile?.mobilityProfile?.transferSupport) missing.push("healthProfile.mobilityProfile");
      if (!state.resident.healthProfile?.memoryProfile?.reassuranceStyle) missing.push("healthProfile.memoryProfile");
      if (!state.medications?.length) missing.push("medications");
      if (missing.length) return send(res, 400, {error: `Missing resident onboarding fields: ${missing.join(", ")}`});
      state.resident.onboardingComplete = true;
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "GET" && url.pathname === "/api/circle") {
      return send(res, 200, circleView(state, url.searchParams.get("personId") || "rita"));
    }

    if (req.method === "POST" && url.pathname === "/api/safety/phone-analytics") {
      state.safety.liveTrackingEnabled = payload.liveTrackingEnabled ?? state.safety.liveTrackingEnabled;
      state.safety.lastUpdated = new Date().toISOString();
      state.safety.location = {
        ...state.safety.location,
        ...(payload.location || {})
      };
      state.safety.movement = {
        ...state.safety.movement,
        status: payload.movementStatus || state.safety.movement.status,
        stepsLastHour: payload.stepsLastHour ?? state.safety.movement.stepsLastHour,
        stillMinutes: payload.stillMinutes ?? state.safety.movement.stillMinutes,
        lastKnownSpeedMph: payload.lastKnownSpeedMph ?? state.safety.movement.lastKnownSpeedMph,
        phoneBattery: payload.phoneBattery ?? state.safety.movement.phoneBattery
      };
      state.safety.fallDetection = {
        status: payload.impactDetected ? "possible-fall" : "clear",
        confidence: payload.fallConfidence ?? state.safety.fallDetection.confidence,
        lastEvent: payload.impactDetected ? new Date().toISOString() : state.safety.fallDetection.lastEvent
      };
      if (payload.safeZoneStatus) {
        state.safety.safeZones = state.safety.safeZones.map(zone => zone.id === "home" ? {...zone, status: payload.safeZoneStatus} : zone);
      }
      evaluateSafety(state, payload);
      addAuditLog(state, {
        action: "phone_analytics_ingested",
        entityType: "safety_telemetry",
        severity: payload.impactDetected || payload.safeZoneStatus === "outside" ? "high" : "info",
        actor: "mobile-phone-sensors",
        details: `movement=${payload.movementStatus || state.safety.movement.status}, fallConfidence=${payload.fallConfidence ?? state.safety.fallDetection.confidence}, safeZone=${payload.safeZoneStatus || "unchanged"}`
      });
      writeState(state);
      return send(res, 200, {state, safety: state.safety});
    }

    if (req.method === "POST" && url.pathname === "/api/safety/voice-sos") {
      const detected = classifyVoiceSosCommand(payload.command || payload.phrase);
      if (!detected) return send(res, 400, {error: "Voice command is not configured as an SOS command"});
      if (payload.confirmed !== true) return send(res, 409, {error: "Voice SOS requires confirmation before escalation"});
      const source = payload.source || "mobile-voice";
      const sosEvent = createSosEvent(state, {
        type: detected.type,
        severity: detected.severity,
        source,
        route: detected.route,
        emergencyNumber: detected.emergencyNumber,
        command: detected.label,
        nativeDialStatus: detected.emergencyNumber ? "pending-native-confirmation" : "not-required",
        body: `${state.resident.name} triggered Voice SOS: "${detected.label}". Route: ${detected.route}. ${detected.emergencyNumber ? `Prepare native emergency call to ${detected.emergencyNumber}.` : "Trusted circle should call immediately."}`
      });
      state.safety.lastUpdated = sosEvent.createdAt;
      state.safety.voiceSos = {
        enabled: true,
        lastCommand: detected.label,
        lastRoute: detected.route,
        lastTriggeredAt: sosEvent.createdAt,
        nativeDialStatus: sosEvent.nativeDialStatus
      };
      addAuditLog(state, {
        action: "voice_sos_command_confirmed",
        entityType: "voice_sos",
        entityId: sosEvent.id,
        severity: detected.severity,
        actor: source,
        details: `${detected.label} -> ${detected.route}`
      });
      writeState(state);
      return send(res, 201, {state, safety: state.safety, sosEvent});
    }

    if (req.method === "POST" && url.pathname === "/api/health/vitals") {
      const consent = ensureHealthConsent(state);
      const vitals = ensureHealthVitals(state);
      const readings = Array.isArray(payload.readings) ? payload.readings : [payload];
      const requestedTypes = [...new Set(readings.flatMap(healthReadingDataTypes))];
      const missingTypes = requestedTypes.filter(type => !(consent.dataTypes || []).includes(type));
      if (!consent.granted) return send(res, 403, {error: "Health data sync requires resident consent"});
      if (missingTypes.length) return send(res, 403, {error: `Missing health consent for: ${missingTypes.join(", ")}`});
      if (payload.source && consent.source && payload.source !== consent.source) return send(res, 403, {error: `Health data source mismatch. Expected ${consent.source}`});
      const normalized = readings.map((reading, index) => ({
        id: `vital_${Date.now()}_${index}`,
        capturedAt: reading.capturedAt || new Date().toISOString(),
        source: reading.source || payload.source || "mobile-health-sync",
        heartRate: Number(reading.heartRate),
        oxygenSaturation: Number(reading.oxygenSaturation),
        respiratoryRate: Number(reading.respiratoryRate),
        hrv: Number(reading.hrv),
        sleepMinutes: Number(reading.sleepMinutes),
        caloriesToday: Number(reading.caloriesToday),
        stepsToday: Number(reading.stepsToday)
      }));
      vitals.readings = normalized.concat(vitals.readings || []).slice(0, 100);
      vitals.lastSyncedAt = new Date().toISOString();
      vitals.source = payload.source || normalized[0]?.source || "mobile-health-sync";
      vitals.summary = evaluateHealthVitals(vitals.readings.slice(0, 24));
      vitals.latestSummary = evaluateHealthVitals(normalized);
      const alertSummary = vitals.latestSummary.riskLevel === "high" ? vitals.latestSummary : vitals.summary;
      if (alertSummary.riskLevel === "high") {
        createSosEvent(state, {
          type: "health-vitals-risk",
          severity: "high",
          source: vitals.source,
          route: "trusted-circle-health-alert",
          body: `${state.resident.name} has elevated health risk signals: ${alertSummary.riskReasons.join(", ")}. Trusted circle notification triggered.`
        });
      }
      addAuditLog(state, {
        action: "health_vitals_synced",
        entityType: "health_vitals",
        severity: vitals.latestSummary.riskLevel === "high" ? "high" : "info",
        actor: payload.source || "mobile-health-sync",
        details: `readings=${normalized.length}, risk=${vitals.latestSummary.riskLevel}, reasons=${vitals.latestSummary.riskReasons.join(",") || "none"}`
      });
      writeState(state);
      return send(res, 201, {state, healthVitals: vitals});
    }

    if (req.method === "PATCH" && url.pathname === "/api/health/consent") {
      const allowedTypes = ["heartRate", "oxygenSaturation", "respiratoryRate", "hrv", "sleep", "calories", "steps"];
      const dataTypes = Array.isArray(payload.dataTypes) ? payload.dataTypes.filter(type => allowedTypes.includes(type)) : [];
      const source = payload.source || "mobile-healthkit-health-connect-sync";
      state.healthConsent = {
        residentId: state.resident.id,
        granted: payload.granted === true,
        source,
        dataTypes,
        updatedAt: new Date().toISOString()
      };
      addAuditLog(state, {
        action: payload.granted === true ? "health_consent_granted" : "health_consent_revoked",
        entityType: "health_consent",
        entityId: state.resident.id,
        severity: "info",
        actor: state.resident.name,
        details: `${source}: ${dataTypes.join(",") || "none"}`
      });
      writeState(state);
      return send(res, 200, {state, healthConsent: state.healthConsent});
    }

    if (req.method === "POST" && url.pathname === "/api/wearables/telemetry") {
      const wearables = ensureWearables(state);
      const incomingDevices = Array.isArray(payload.devices) ? payload.devices : [];
      const capturedAt = new Date().toISOString();
      const normalizedDevices = incomingDevices.map(device => ({
        id: String(device.id || `wearable_${Date.now()}`),
        type: String(device.type || "unknown"),
        name: String(device.name || "Wearable device"),
        status: device.status === "disconnected" ? "disconnected" : "connected",
        batteryPercent: Number(device.batteryPercent ?? 0),
        signal: String(device.signal || "Safety signal"),
        lastSeenAt: device.lastSeenAt || capturedAt,
        fallConfidence: Number(device.fallConfidence || 0),
        sosPressed: Boolean(device.sosPressed)
      }));
      const deviceMap = new Map((wearables.devices || []).map(device => [device.id, device]));
      for (const device of normalizedDevices) deviceMap.set(device.id, device);
      wearables.devices = Array.from(deviceMap.values());
      wearables.proximity = {
        currentZone: payload.proximity?.currentZone || wearables.proximity.currentZone || "unknown",
        distanceMeters: Number(payload.proximity?.distanceMeters ?? wearables.proximity.distanceMeters ?? 0),
        safe: payload.proximity?.safe !== undefined ? Boolean(payload.proximity.safe) : wearables.proximity.safe,
        lastSeenAt: payload.proximity?.lastSeenAt || capturedAt
      };
      wearables.lastSyncedAt = capturedAt;
      wearables.latestSummary = evaluateWearables(wearables.devices, wearables.proximity);
      if (wearables.latestSummary.riskLevel === "high") {
        createSosEvent(state, {
          type: wearables.latestSummary.sosPressed ? "wearable-sos-pressed" : "wearable-fall-detected",
          severity: "critical",
          source: payload.source || "mobile-wearable-sync",
          route: "trusted-circle-and-emergency-review",
          body: `${state.resident.name} has a wearable safety alert: ${wearables.latestSummary.riskReasons.join(", ")}. Trusted circle notification triggered.`
        });
      }
      addAuditLog(state, {
        action: "wearable_telemetry_synced",
        entityType: "wearable_telemetry",
        severity: wearables.latestSummary.riskLevel === "high" ? "critical" : wearables.latestSummary.riskLevel === "watch" ? "high" : "info",
        actor: payload.source || "mobile-wearable-sync",
        details: `devices=${normalizedDevices.length}, risk=${wearables.latestSummary.riskLevel}, reasons=${wearables.latestSummary.riskReasons.join(",") || "none"}`
      });
      writeState(state);
      return send(res, 201, {state, wearables});
    }

    if (req.method === "POST" && url.pathname === "/api/circle/accept-invite") {
      const inviteCode = String(payload.inviteCode || "").trim().toUpperCase();
      const person = state.people.find(item => String(item.inviteCode || "").toUpperCase() === inviteCode);
      if (!person) return send(res, 404, {error: "Invite code not found"});
      return send(res, 200, circleView(state, person.id));
    }

    if (req.method === "POST" && url.pathname === "/api/circle/tasks/ack") {
      const task = state.circleTasks.find(item => item.id === payload.id);
      if (!task) return send(res, 404, {error: "Task not found"});
      task.status = "acknowledged";
      task.acknowledgedAt = new Date().toISOString();
      writeState(state);
      return send(res, 200, circleView(state, task.assignedTo));
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/sos-events/") && url.pathname.endsWith("/ack")) {
      const id = url.pathname.split("/")[3];
      const event = state.safety.sosEvents.find(item => item.id === id);
      if (!event) return send(res, 404, {error: "SOS event not found"});
      const person = state.people.find(item => item.id === payload.personId) || state.people[0];
      if (!((person.permissions || []).includes("sos") || (person.permissions || []).includes("safety"))) {
        return send(res, 403, {error: "Trusted person does not have SOS permission"});
      }
      event.status = "acknowledged";
      event.acknowledgedBy = person.name;
      event.acknowledgedAt = new Date().toISOString();
      state.messages.unshift({from: person.name, body: `Acknowledged SOS event: ${event.type}.`});
      addAuditLog(state, {
        action: "sos_event_acknowledged",
        entityType: "sos_event",
        entityId: event.id,
        severity: "info",
        actor: person.name,
        details: event.type
      });
      for (const task of state.circleTasks.filter(item => item.assignedTo === person.id && item.type === event.type && item.status === "open")) {
        task.status = "acknowledged";
        task.acknowledgedAt = event.acknowledgedAt;
      }
      writeState(state);
      return send(res, 200, {state, event, circle: circleView(state, person.id)});
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/sos-events/") && url.pathname.endsWith("/escalate")) {
      const id = url.pathname.split("/")[3];
      const event = state.safety.sosEvents.find(item => item.id === id);
      if (!event) return send(res, 404, {error: "SOS event not found"});
      const person = state.people.find(item => item.id === payload.personId) || state.people[0];
      if (!((person.permissions || []).includes("sos") || (person.permissions || []).includes("safety"))) {
        return send(res, 403, {error: "Trusted person does not have SOS permission"});
      }
      event.status = "escalated";
      event.escalatedBy = person.name;
      event.escalatedAt = new Date().toISOString();
      event.escalationRoute = payload.route || "call-emergency-and-circle";
      event.severity = "critical";
      state.messages.unshift({from: person.name, body: `Escalated SOS event: ${event.type}. Route: ${event.escalationRoute}.`});
      addAuditLog(state, {
        action: "sos_event_escalated",
        entityType: "sos_event",
        entityId: event.id,
        severity: "critical",
        actor: person.name,
        details: `${event.type} -> ${event.escalationRoute}`
      });
      for (const contact of emergencyContacts(state)) {
        state.circleTasks.unshift({
          id: `circle_task_${Date.now()}_${contact.id}_escalation`,
          assignedTo: contact.id,
          resident: state.resident.name,
          type: "sos-escalated",
          body: `${person.name} escalated ${event.type}. Route: ${event.escalationRoute}.`,
          status: "open"
        });
      }
      enqueueSafetyNotifications(state, {
        ...event,
        id: event.id,
        type: "sos-escalated",
        severity: "critical",
        body: `${person.name} escalated ${event.type}. Route: ${event.escalationRoute}.`
      });
      writeState(state);
      return send(res, 200, {state, event, circle: circleView(state, person.id)});
    }

    if (req.method === "GET" && url.pathname === "/api/notifications") {
      const queue = ensureNotificationQueue(state);
      const personId = url.searchParams.get("personId");
      const filtered = personId ? queue.filter(item => item.personId === personId) : queue;
      return send(res, 200, {notifications: filtered.slice(0, 100)});
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/notifications/") && url.pathname.endsWith("/mark-delivered")) {
      const id = url.pathname.split("/")[3];
      const queue = ensureNotificationQueue(state);
      const notification = queue.find(item => item.id === id);
      if (!notification) return send(res, 404, {error: "Notification not found"});
      notification.status = payload.status || "delivered";
      notification.provider = payload.provider || `${notification.channel}-simulator`;
      notification.providerMessageId = payload.providerMessageId || `${notification.channel}_${Date.now()}`;
      notification.deliveredAt = new Date().toISOString();
      writeState(state);
      return send(res, 200, {state, notification});
    }

    if (req.method === "POST" && url.pathname === "/api/notifications/process") {
      const delivered = processNotificationQueue(state, payload.limit || 10);
      addAuditLog(state, {
        action: "notification_queue_processed",
        entityType: "notification_queue",
        severity: "info",
        actor: "superadmin",
        details: `delivered=${delivered.length}, remaining=${ensureNotificationQueue(state).filter(item => item.status === "queued").length}`
      });
      writeState(state);
      return send(res, 200, {
        delivered,
        remainingQueued: ensureNotificationQueue(state).filter(item => item.status === "queued").length
      });
    }

    if (req.method === "POST" && url.pathname === "/api/circle/help-message") {
      const person = state.people.find(item => item.id === payload.personId);
      if (!person) return send(res, 404, {error: "Connected person not found"});
      if (!(person.permissions || []).includes("messages")) return send(res, 403, {error: "This person does not have message permission"});
      state.messages.unshift({from: person.name, body: payload.body || "Checking in to see how you are doing."});
      writeState(state);
      return send(res, 201, circleView(state, person.id));
    }

    if (req.method === "PATCH" && url.pathname === "/api/business") {
      state.business = {
        ...state.business,
        ...payload,
        demographics: Array.isArray(payload.demographics) ? payload.demographics : String(payload.demographics || state.business.demographics.join(",")).split(",").map(item => item.trim()).filter(Boolean),
        serviceAreas: Array.isArray(payload.serviceAreas) ? payload.serviceAreas : String(payload.serviceAreas || state.business.serviceAreas.join(",")).split(",").map(item => item.trim()).filter(Boolean)
      };
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "POST" && url.pathname === "/api/business/complete") {
      const required = ["name", "contactPerson", "email", "phone", "website", "googleBusinessProfile"];
      const missing = required.filter(field => !state.business[field]);
      if (!state.business.serviceAreas.length) missing.push("serviceAreas");
      if (!state.business.demographics.length) missing.push("demographics");
      if (!businessServices(state).length) missing.push("services");
      if (missing.length) return send(res, 400, {error: `Missing onboarding fields: ${missing.join(", ")}`});
      state.business.onboardingComplete = true;
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "PATCH" && url.pathname === "/api/business/plan") {
      if (!["free", "paid"].includes(payload.plan)) return send(res, 400, {error: "Invalid plan"});
      state.business.plan = payload.plan;
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "POST" && url.pathname === "/api/business/top-up") {
      const amount = Math.max(1, Number(payload.leads || 1));
      state.business.leadQuota.topUps += amount;
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "POST" && url.pathname === "/api/business/services") {
      const entitlement = planEntitlement(state.business);
      if (businessServices(state).length >= entitlement.serviceLimit) {
        return send(res, 402, {error: "Free package includes 1 service. Upgrade to the $100/month plan to add more services."});
      }
      const name = String(payload.name || "").trim();
      const category = String(payload.category || "").trim();
      if (!name || !category) return send(res, 400, {error: "Service name and category are required"});
      state.services.unshift({
        id: `service_${Date.now()}`,
        name,
        category,
        rating: 4.8,
        price: payload.price || "Custom quote",
        eta: payload.eta || "Available by request",
        provider: state.business.name
      });
      writeState(state);
      return send(res, 201, state);
    }

    if (req.method === "POST" && url.pathname === "/api/medications/confirm") {
      const med = state.medications.find(item => item.id === payload.id);
      if (!med) return send(res, 404, {error: "Medication not found"});
      if (med.status === "taken") {
        return send(res, 200, {...state, medication: med, alreadyTaken: true});
      }
      med.status = "taken";
      med.remaining = Math.max(0, med.remaining - 1);
      med.lastConfirmedAt = new Date().toISOString();
      state.messages.unshift({from: "System", body: `${med.name} marked as taken.`});
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "POST" && url.pathname === "/api/refills") {
      const med = state.medications.find(item => item.id === payload.medicationId);
      if (!med) return send(res, 404, {error: "Medication not found"});
      state.refills.unshift({id: `refill_${Date.now()}`, medication: med.name, status: "requested", createdAt: new Date().toISOString()});
      state.requests.unshift({id: `req_refill_${Date.now()}`, resident: state.resident.name, type: `Refill: ${med.name}`, time: "Today", distance: "Medicine delivery", status: "new", provider: "HealthPlus Pharmacy"});
      writeState(state);
      return send(res, 201, state);
    }

    if (req.method === "POST" && url.pathname === "/api/help/match") {
      return send(res, 200, {matches: scoreServices(state, payload.need || "")});
    }

    if (req.method === "POST" && url.pathname === "/api/bookings") {
      const service = state.services.find(item => item.id === payload.serviceId);
      if (!service) return send(res, 404, {error: "Service not found"});
      if (payload.consumeLead) {
        const entitlement = planEntitlement(state.business);
        if (entitlement.used >= entitlement.leadAllowance) {
          return send(res, 402, {error: `Lead limit reached for the ${entitlement.name} package. Add a top-up or upgrade before accepting more leads.`});
        }
        if (state.business.plan === "paid") state.business.leadQuota.usedThisMonth += 1;
        else state.business.leadQuota.usedThisYear += 1;
      }
      const booking = {id: `booking_${Date.now()}`, resident: state.resident.name, service: payload.label || service.name, time: payload.time || "Tomorrow, 10:00 AM", status: "pending", provider: service.provider};
      state.bookings.unshift(booking);
      state.requests.unshift({id: `req_${Date.now()}`, resident: state.resident.name, type: booking.service, time: booking.time, distance: service.price, status: "matched", provider: service.provider});
      writeState(state);
      return send(res, 201, state);
    }

    if (req.method === "PATCH" && url.pathname.startsWith("/api/bookings/")) {
      const id = url.pathname.split("/").pop();
      const booking = state.bookings.find(item => item.id === id);
      if (!booking) return send(res, 404, {error: "Booking not found"});
      booking.status = payload.status || booking.status;
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "POST" && url.pathname === "/api/events/join") {
      const event = state.events.find(item => item.id === payload.id);
      if (!event) return send(res, 404, {error: "Event not found"});
      event.joined = true;
      writeState(state);
      return send(res, 200, state);
    }

    if (req.method === "POST" && url.pathname === "/api/posts") {
      state.posts.unshift({id: `post_${Date.now()}`, author: state.resident.name, body: payload.body || "Shared an update.", likes: 0, comments: 0});
      writeState(state);
      return send(res, 201, state);
    }

    if (req.method === "POST" && url.pathname === "/api/messages") {
      const userText = payload.body || "";
      state.messages.unshift({from: state.resident.name, body: userText});
      const reply = userText.toLowerCase().includes("sleep")
        ? "I am sorry you did not sleep well. Want to try a two-minute breathing check-in?"
        : userText.toLowerCase().includes("lonely")
          ? "I can stay with you here, or help you call Rita or find a nearby activity."
          : "I can help with that. Tell me if this is urgent, scheduled, or just something on your mind.";
      state.messages.unshift({from: "Guru", body: reply});
      writeState(state);
      return send(res, 201, state);
    }

    return send(res, 404, {error: "Not found"});
  }).catch(error => send(res, 400, {error: error.message}));
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = path.normalize(path.join(publicDir, requested));
  if (!file.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(file, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {"Content-Type": contentTypes[path.extname(file)] || "application/octet-stream"});
    res.end(data);
  });
}

function appHandler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS"
    });
    res.end();
    return;
  }
  if (req.url.startsWith("/api/")) return routeApi(req, res);
  serveStatic(req, res);
}

if (require.main === module) {
  http.createServer(appHandler).listen(port, () => {
    console.log(`TheSeniorguru app running at http://localhost:${port}`);
  });
}

module.exports = appHandler;
module.exports.appHandler = appHandler;
