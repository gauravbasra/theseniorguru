const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const origin = baseUrl.replace(/\/$/, "");
const endpoint = `${origin}/api/v1/admin/public-source-acquisition/current-site-run`;
const accessCode = process.env.ADMIN_ACCESS_CODE ?? "theseniorguru-launch-2026";
const maxRecords = Number(process.env.SMOKE_MAX_RECORDS ?? 18);

const loginResponse = await fetch(`${origin}/api/v1/auth/login`, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json"
  },
  body: JSON.stringify({ accessCode })
});
const cookie = loginResponse.headers.get("set-cookie")?.split(";")[0];

if (!loginResponse.ok || !cookie) {
  const payload = await loginResponse.json().catch(() => ({}));
  console.error(JSON.stringify({ endpoint: `${origin}/api/v1/auth/login`, status: loginResponse.status, payload }, null, 2));
  process.exit(1);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    accept: "application/json",
    "content-type": "application/json",
    cookie
  },
  body: JSON.stringify({ actorId: "smoke-current-site-acquisition", dryRun: false, maxRecords })
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(JSON.stringify({ endpoint, status: response.status, payload }, null, 2));
  process.exit(1);
}

const data = payload.data;

if (!data || data.totalRecords < Math.min(maxRecords, 9) || data.stagedRecords < Math.min(maxRecords, 9) || data.discoveredListings < data.stagedRecords) {
  console.error(JSON.stringify({ endpoint, status: response.status, payload }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      endpoint,
      status: response.status,
      batchId: data.batchId,
      discoveredListings: data.discoveredListings,
      stagedRecords: data.stagedRecords,
      rejectedRecords: data.rejectedRecords,
      errorRecords: data.errorRecords,
      skippedRecords: data.skippedRecords,
      imageCoverage: data.imageCoverage,
      qualityGapCount: data.qualityGaps.length,
      sourcePolicies: data.sourcePolicies
    },
    null,
    2
  )
);
