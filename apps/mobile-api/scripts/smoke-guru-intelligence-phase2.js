#!/usr/bin/env node

const assert = require("assert");
const { Pool } = require("pg");

const apiBase = process.env.API_BASE_URL || "http://127.0.0.1:4187";

const requiredTables = [
  "guru_baselines",
  "guru_trends",
  "guru_recommendations",
  "guru_explanations",
  "family_relationships",
  "family_interactions"
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
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [requiredTables]
    );
    const existing = new Set(result.rows.map(row => row.table_name));
    const missing = requiredTables.filter(table => !existing.has(table));
    assert.deepEqual(missing, [], `Missing Phase 2 tables: ${missing.join(", ")}`);
  } finally {
    await pool.end();
  }
}

async function main() {
  await assertTables();
  const session = await request("/api/auth/device-session", {
    method: "POST",
    body: JSON.stringify({ installationId: `guru-phase2-${Date.now()}`, role: "senior" })
  });
  const token = session.token;
  assert.ok(token, "device session must return token");

  await request("/api/context/observations", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({
      environment: { provider: "phase2-smoke", aqi: 112, pollenLevel: "high", snowProbabilityPercent: 0 },
      mobility: { stepsToday: 1800, stepsBaseline: 5200, stepsDeltaPercent: -65, weatherAdjusted: false },
      social: { daysWithoutFamilyContact: 5, daysWithoutSocialInteraction: 7, familyInteractions: 0 },
      location: { label: "Home", safeZoneStatus: "inside", movementStatus: "still" }
    })
  });

  const recalculated = await request("/api/guru/risk-recalculate", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({})
  });
  assert.ok(Array.isArray(recalculated.reasons), "risk engine must produce plain-language reasons");
  assert.ok(recalculated.reasons.length > 0, "risk engine must explain what changed");
  assert.ok(Array.isArray(recalculated.whatChanged), "risk engine must return whatChanged");
  assert.ok(Array.isArray(recalculated.whyItMatters), "risk engine must return whyItMatters");
  assert.ok(recalculated.recommendedAction?.title, "risk engine must return recommendedAction");
  assert.ok(recalculated.baselines?.length >= 1, "risk engine must compute baselines");
  assert.ok(recalculated.trends?.length >= 1, "risk engine must compute trends");

  const daily = await request("/api/guru/daily-status", { headers: auth(token) });
  assert.ok(daily.whatChanged?.length, "daily status must include what changed");
  assert.ok(daily.whyItMatters?.length, "daily status must include why it matters");
  assert.ok(daily.recommendedAction?.title, "daily status must include recommended action");
  assert.ok(daily.explanation?.reasons?.length, "daily status must include explanation reasons");
  assert.ok(daily.familyContext, "daily status must include family context");
  assert.ok(!String(daily.summary || "").includes("risk_score"), "daily status must speak plainly, not raw metrics");

  console.log("Guru intelligence Phase 2 smoke passed");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
