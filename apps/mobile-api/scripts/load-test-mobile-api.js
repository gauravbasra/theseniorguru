#!/usr/bin/env node
const { performance } = require("perf_hooks");

const baseUrl = (process.env.API_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const users = Number(process.env.LOAD_TEST_USERS || 25);
const iterations = Number(process.env.LOAD_TEST_ITERATIONS || 20);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY || 10);
const token = process.env.LOAD_TEST_TOKEN || "";

function headers() {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  };
}

function samplePayload(path, userIndex, iteration) {
  if (path === "/api/health/vitals") {
    return {
      source: "mobile-healthkit-health-connect-sync",
      readings: [{
        heartRate: 72 + (iteration % 18),
        stepsToday: 1200 + iteration,
        capturedAt: new Date().toISOString()
      }]
    };
  }
  if (path === "/api/safety/phone-analytics") {
    return {
      location: { lat: 43.6532 + userIndex / 10000, lng: -79.3832, accuracyMeters: 12, label: "Load Test Route" },
      movementStatus: iteration % 3 === 0 ? "walking" : "still",
      stepsLastHour: 200 + iteration,
      stillMinutes: iteration % 7,
      phoneBattery: 82,
      fallConfidence: 0.05,
      impactDetected: false
    };
  }
  if (path === "/api/messages") {
    return { recipient: "trusted-circle", priority: "normal", body: `Load test message ${userIndex}-${iteration}` };
  }
  return {
    serviceId: process.env.LOAD_TEST_SERVICE_ID || "00000000-0000-0000-0000-000000000001",
    label: `Load test booking ${userIndex}-${iteration}`,
    fulfillmentMode: "direct_provider",
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

async function hit(path, userIndex, iteration) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(samplePayload(path, userIndex, iteration))
  });
  const durationMs = performance.now() - started;
  const body = await response.text();
  return { path, status: response.status, ok: response.ok, durationMs, body: body.slice(0, 300) };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function worker(jobs, results) {
  while (jobs.length) {
    const job = jobs.shift();
    try {
      results.push(await hit(job.path, job.userIndex, job.iteration));
    } catch (error) {
      results.push({ path: job.path, status: 0, ok: false, durationMs: 0, body: error.message });
    }
  }
}

async function main() {
  const paths = ["/api/health/vitals", "/api/safety/phone-analytics", "/api/messages", "/api/bookings"];
  const jobs = [];
  for (let userIndex = 0; userIndex < users; userIndex += 1) {
    for (let iteration = 0; iteration < iterations; iteration += 1) {
      jobs.push({ userIndex, iteration, path: paths[(userIndex + iteration) % paths.length] });
    }
  }
  const results = [];
  await Promise.all(Array.from({ length: concurrency }, () => worker(jobs, results)));
  const latencies = results.filter(result => result.durationMs > 0).map(result => result.durationMs);
  const byStatus = results.reduce((acc, result) => {
    const key = String(result.status);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const failures = results.filter(result => !result.ok).slice(0, 10);
  console.log(JSON.stringify({
    baseUrl,
    LOAD_TEST_USERS: users,
    LOAD_TEST_ITERATIONS: iterations,
    LOAD_TEST_CONCURRENCY: concurrency,
    totalRequests: results.length,
    success: results.filter(result => result.ok).length,
    failed: results.filter(result => !result.ok).length,
    byStatus,
    latencyMs: {
      p50: Math.round(percentile(latencies, 50)),
      p95: Math.round(percentile(latencies, 95)),
      p99: Math.round(percentile(latencies, 99))
    },
    sampleFailures: failures
  }, null, 2));
  if (failures.length) process.exitCode = 1;
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
