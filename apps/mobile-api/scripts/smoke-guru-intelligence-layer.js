#!/usr/bin/env node

const assert = require("assert");
const { Pool } = require("pg");

const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:4187";

const requiredTables = [
  "health_daily_metrics",
  "location_daily_metrics",
  "environmental_daily_metrics",
  "social_daily_metrics",
  "guru_risk_scores",
  "safe_zones"
];

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
    throw new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${json.error || text}`);
  }
  return json;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function assertTables() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for schema verification");
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [requiredTables]
    );
    const existing = new Set(result.rows.map(row => row.table_name));
    const missing = requiredTables.filter(table => !existing.has(table));
    assert.deepEqual(missing, [], `Missing Guru intelligence tables: ${missing.join(", ")}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  await assertTables();
  const session = await request("/api/auth/device-session", {
    method: "POST",
    body: JSON.stringify({ installationId: `guru-intelligence-${Date.now()}`, role: "senior" })
  });
  const token = session.token;
  assert.ok(token, "device session must return a token");

  await request("/api/context/observations", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      environment: {
        provider: "guru-intelligence-smoke",
        condition: "Snow expected",
        temperatureF: 31,
        aqi: 91,
        pollenLevel: "high",
        uvIndex: 2,
        snowProbabilityPercent: 70,
        stormRisk: "medium"
      },
      mobility: {
        stepsToday: 1900,
        stepsBaseline: 5200,
        stepsDeltaPercent: -64,
        distanceMeters: 1100,
        communityVisits: 0,
        weatherAdjusted: true,
        reasons: ["snow expected"]
      },
      social: {
        daysWithoutFamilyContact: 5,
        trustedCircleTouchCount: 0,
        communityInteractionCount: 0
      },
      location: {
        label: "Outside pharmacy",
        lat: 39.5447,
        lng: -104.9673,
        movementStatus: "traveling",
        safeZoneStatus: "outside"
      }
    })
  });

  const recalculated = await request("/api/guru/risk-recalculate", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({})
  });
  assert.ok(recalculated.riskScore?.id, "risk recalculation must persist a guru_risk_scores row");
  assert.match(recalculated.riskScore.final_status, /STABLE|WATCH|NEEDS_CHECKIN|EMERGENCY/);
  assert.ok(Array.isArray(recalculated.recommendations), "risk recalculation must return recommendations");

  const daily = await request("/api/guru/daily-status", { headers: auth(token) });
  assert.ok(daily.status, "daily status must return status");
  assert.ok(Number.isFinite(Number(daily.confidence)), "daily status must return confidence");
  assert.ok(Array.isArray(daily.recommendations), "daily status must return recommendations");
  assert.ok(daily.summary, "daily status must explain why");

  for (const endpoint of ["health", "social", "environment", "mobility", "safety"]) {
    const summary = await request(`/api/guru/${endpoint}-summary`, { headers: auth(token) });
    assert.equal(summary.domain, endpoint, `${endpoint} summary must identify its domain`);
    assert.ok(summary.summary, `${endpoint} summary must explain the signal`);
    assert.ok(Array.isArray(summary.recommendations), `${endpoint} summary must return recommendations`);
  }

  console.log("Guru intelligence layer smoke passed");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
