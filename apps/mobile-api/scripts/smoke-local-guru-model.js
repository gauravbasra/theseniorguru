#!/usr/bin/env node

const assert = require("assert");

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

async function main() {
  const session = await request("/api/auth/device-session", {
    method: "POST",
    body: JSON.stringify({ installationId: `local-guru-${Date.now()}`, role: "senior" })
  });
  const token = session.token;
  assert.ok(token, "device session must return token");

  const routineMessages = [
    "I need a ride tomorrow",
    "Did I take my medication?",
    "High pollen today?",
    "I feel lonely",
    "remind me to drink water"
  ];

  for (const message of routineMessages) {
    const result = await request("/api/guru/orchestrate", {
      method: "POST",
      headers: auth(token),
      body: JSON.stringify({ message, screen: "local-guru-smoke" })
    });
    assert.ok(result.reply, `local Guru must answer: ${message}`);
    assert.notEqual(result.event?.provider, "openai", `routine intent must not use OpenAI: ${message}`);
    assert.ok(
      ["local_small_language_model", "local"].includes(result.event?.provider),
      `routine intent must use local provider: ${message}`
    );
    assert.equal(result.aiConfigured, false, `routine intent should report no remote AI spend: ${message}`);
  }

  console.log("Local Guru model smoke passed");
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
