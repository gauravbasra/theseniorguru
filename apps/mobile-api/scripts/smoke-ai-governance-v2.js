#!/usr/bin/env node

const assert = require("assert");
const { Pool } = require("pg");

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
    throw new Error(`${options.method || "GET"} ${path} failed ${response.status}: ${json.error || text}`);
  }
  return json;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function adminToken() {
  const session = await request("/api/auth/dev-session", {
    method: "POST",
    body: JSON.stringify({ email: "admin@theseniorguru.local" })
  });
  return session.token;
}

async function seniorSession() {
  const session = await request("/api/auth/device-session", {
    method: "POST",
    body: JSON.stringify({ installationId: `ai-governance-${Date.now()}`, role: "senior" })
  });
  return session;
}

async function withDb(fn) {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

async function main() {
  await withDb(async pool => {
    const tables = ["ai_routing_policies", "ai_budget_windows", "ai_usage_daily", "ai_fallback_events", "ai_response_cache", "guru_model_invocations"];
    const result = await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1)`, [tables]);
    const existing = new Set(result.rows.map(row => row.table_name));
    const missing = tables.filter(table => !existing.has(table));
    assert.deepEqual(missing, [], `Missing AI governance tables: ${missing.join(", ")}`);
  });

  const admin = await adminToken();
  const senior = await seniorSession();
  const token = senior.token;
  const state = await request("/api/state", { headers: auth(token) });
  const seniorId = state.resident?.id;
  assert.ok(seniorId, "senior state must expose resident id");

  const routine = await request("/api/guru/orchestrate", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ message: "Did I take my medication?", screen: "ai-governance-smoke" })
  });
  assert.ok(routine.reply, "routine request must succeed");
  assert.notEqual(routine.event?.provider, "openai", "routine request must not use remote AI");

  const companionship = await request("/api/guru/orchestrate", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ message: "I feel lonely and want to talk for a while", screen: "ai-governance-smoke" })
  });
  assert.ok(companionship.reply, "companionship must return graceful reply");
  assert.notEqual(companionship.event?.provider, "openai", "fake/no remote path must gracefully fallback locally");

  await request("/api/admin/ai-budget/windows", {
    method: "POST",
    headers: auth(admin),
    body: JSON.stringify({
      scope: "senior_daily",
      seniorId,
      maxRemoteCalls: 0,
      maxEstimatedCostUsd: 0,
      windowType: "daily",
      status: "active"
    })
  });
  const budgeted = await request("/api/guru/model/route-debug", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ message: "Can you help me think through a complicated family situation?", intent: "complex_reasoning" })
  });
  assert.equal(budgeted.decision.usedRemoteAi, false, "budget exceeded must force local-only mode");
  assert.match(budgeted.decision.routeReason, /budget|local/i, "route reason must explain budget/local decision");

  const sos = await request("/api/guru/model/route-debug", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ message: "SOS I fell and need help", intent: "safety" })
  });
  assert.equal(sos.decision.emergencyBypass, true, "SOS must bypass budget restrictions");
  assert.equal(sos.decision.blockedByBudget, false, "SOS must never be blocked by budget");

  const repeatedOne = await request("/api/guru/orchestrate", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ message: "What is the weather guidance today?", screen: "ai-governance-smoke" })
  });
  const repeatedTwo = await request("/api/guru/orchestrate", {
    method: "POST",
    headers: auth(token),
    body: JSON.stringify({ message: "What is the weather guidance today?", screen: "ai-governance-smoke" })
  });
  assert.equal(repeatedTwo.event?.metadata?.cacheHit || repeatedTwo.event?.metadata?.cache_hit, true, "repeated safe question should be cacheable");
  assert.notEqual(repeatedOne.event?.provider, "openai", "cached routine request must not call remote AI");
  assert.notEqual(repeatedTwo.event?.provider, "openai", "cache hit must not call remote AI");

  const summary = await request("/api/admin/ai-usage/summary", { headers: auth(admin) });
  assert.ok(summary.totals, "admin summary must return totals");
  assert.ok("estimatedCostUsd" in summary.totals, "admin summary must include cost");
  assert.ok("promptTokens" in summary.totals, "admin summary must include prompt tokens");
  assert.ok(Array.isArray(summary.byProvider), "admin summary must include provider metrics");
  assert.ok("cacheHits" in summary.totals, "admin summary must include cache metrics");

  await request("/api/admin/ai-usage/by-tenant", { headers: auth(admin) });
  await request(`/api/admin/ai-usage/by-senior/${encodeURIComponent(seniorId)}`, { headers: auth(admin) });
  const policies = await request("/api/admin/ai-routing/policies", { headers: auth(admin) });
  assert.ok(Array.isArray(policies.policies), "routing policies must be readable");
  assert.ok(policies.policies.some(policy => policy.intent === "medication"), "medication policy must exist");

  const invocationCount = await withDb(async pool => {
    const result = await pool.query(`SELECT count(*)::int AS count FROM guru_model_invocations WHERE created_at > now() - interval '10 minutes'`);
    return result.rows[0].count;
  });
  assert.ok(invocationCount >= 5, "all invocations must be logged");

  console.log("AI governance v2 smoke passed");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
