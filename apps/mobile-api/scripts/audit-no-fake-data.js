#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const targets = [
  "apps/flutter-mobile/lib",
  "apps/mobile-api/production-server.js",
  "apps/mobile-api/server.js",
  "apps/mobile-api/public"
];

const rules = [
  {
    id: "demo-persona",
    severity: "blocker",
    pattern: /\b(Anita Sharma|Good morning, Anita|Rita Sharma|CareRide|Park View Community|Sunnyvale|rohit@careride\.local|anita@theseniorguru\.local|rita@theseniorguru\.local)\b/,
    note: "Reference/demo persona text must come from authenticated API state or an explicit smoke fixture, not production UI code."
  },
  {
    id: "demo-ids",
    severity: "blocker",
    pattern: /\b(demo-[a-z0-9_-]+|cs_test_example|file:\/\/\/tmp\/|example\.com|\.example)\b/i,
    note: "Demo ids, example domains, and local file placeholders must not drive live workflows."
  },
  {
    id: "noop-handler",
    severity: "blocker",
    pattern: /(onTap|onPressed):\s*(?:\(\)\s*=>\s*\{\s*\}|\(\)\s*\{\s*\})/,
    note: "Visible controls must call a real route, API action, or disabled state with a clear reason."
  },
  {
    id: "mock-or-placeholder",
    severity: "warning",
    pattern: /\b(TODO|placeholder|mock|fake|hardcoded|seededBy|manual_fallback)\b/i,
    note: "Placeholder wording is allowed only in tests, migrations, or explicit connector readiness metadata."
  }
];

const allowList = [
  /apps\/mobile-api\/scripts\//,
  /apps\/mobile-api\/seed\.sql$/,
  /apps\/mobile-api\/migrations\//,
  /apps\/flutter-mobile\/test\//,
  /apps\/mobile-api\/\.env\.example$/,
  /package-lock\.json$/
];

function walk(entry) {
  const absolute = path.join(repoRoot, entry);
  if (!fs.existsSync(absolute)) return [];
  const stat = fs.statSync(absolute);
  if (stat.isFile()) return [absolute];
  return fs.readdirSync(absolute).flatMap((name) => {
    const child = path.join(absolute, name);
    const childStat = fs.statSync(child);
    if (childStat.isDirectory()) return walk(path.relative(repoRoot, child));
    return [child];
  });
}

function relative(file) {
  return path.relative(repoRoot, file).replace(/\\/g, "/");
}

function isAllowed(file) {
  const rel = relative(file);
  return allowList.some((rule) => rule.test(rel));
}

const files = targets
  .flatMap(walk)
  .filter((file) => /\.(dart|js|sql|html|css|json|env|example)$/.test(file))
  .filter((file) => !isAllowed(file));

const findings = [];
for (const file of files) {
  const rel = relative(file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        findings.push({
          rule: rule.id,
          severity: rule.severity,
          file: rel,
          line: index + 1,
          text: line.trim().slice(0, 220),
          note: rule.note
        });
      }
    }
  });
}

const summary = findings.reduce((acc, item) => {
  acc[item.rule] = (acc[item.rule] || 0) + 1;
  return acc;
}, {});

const payload = {
  ok: findings.filter((item) => item.severity === "blocker").length === 0,
  scannedFiles: files.length,
  summary,
  findings
};

console.log(JSON.stringify(payload, null, 2));

if (process.argv.includes("--fail") && !payload.ok) {
  process.exit(1);
}
