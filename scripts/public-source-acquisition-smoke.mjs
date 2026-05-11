const baseUrl = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const origin = baseUrl.replace(/\/$/, "");
const endpoint = `${origin}/api/v1/admin/public-source-acquisition/sample-run`;
const accessCode = process.env.ADMIN_ACCESS_CODE ?? "theseniorguru-launch-2026";

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
  body: JSON.stringify({ actorId: "smoke-public-source-acquisition", dryRun: false })
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(JSON.stringify({ endpoint, status: response.status, payload }, null, 2));
  process.exit(1);
}

const data = payload.data;

if (!data || data.totalRecords < 3 || data.stagedRecords < 3 || data.imageCoverage.listingsWithThreeImages < 2) {
  console.error(JSON.stringify({ endpoint, status: response.status, payload }, null, 2));
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      endpoint,
      status: response.status,
      batchId: data.batchId,
      stagedRecords: data.stagedRecords,
      rejectedRecords: data.rejectedRecords,
      errorRecords: data.errorRecords,
      imageCoverage: data.imageCoverage,
      qualityGapCount: data.qualityGaps.length
    },
    null,
    2
  )
);
