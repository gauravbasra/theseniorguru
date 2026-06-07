const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const repoRoot = path.resolve(root, "../..");

function read(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  return fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
}

const checks = [
  {
    label: "partition migration",
    file: "apps/mobile-api/migrations/011_hot_table_partitioning.sql",
    patterns: ["PARTITION BY RANGE", "ensure_hot_table_partitions", "safety_telemetry_partitioned"]
  },
  {
    label: "RLS migration",
    file: "apps/mobile-api/migrations/012_rls_security_policies.sql",
    patterns: ["ENABLE ROW LEVEL SECURITY", "CREATE POLICY", "app.current_user_id"]
  },
  {
    label: "object storage migration",
    file: "apps/mobile-api/migrations/013_media_storage_queue_retention.sql",
    patterns: ["CREATE TABLE IF NOT EXISTS media_objects", "upload_url", "storage_key"]
  },
  {
    label: "queue migration",
    file: "apps/mobile-api/migrations/013_media_storage_queue_retention.sql",
    patterns: ["CREATE TABLE IF NOT EXISTS job_queue", "notification_delivery", "ride_dispatch"]
  },
  {
    label: "retention migration",
    file: "apps/mobile-api/migrations/014_retention_archive_jobs.sql",
    patterns: ["archive_old_operational_data", "audit_logs_archive", "notification_delivery_attempts_archive"]
  },
  {
    label: "media signed URL routes",
    file: "apps/mobile-api/production-server.js",
    patterns: ["/api/media/upload-url", "/api/media/download-url", "media_object_created"]
  },
  {
    label: "queue worker",
    file: "apps/mobile-api/scripts/process-job-queue.js",
    patterns: ["FOR UPDATE SKIP LOCKED", "notification_delivery", "ride_dispatch"]
  },
  {
    label: "retention worker",
    file: "apps/mobile-api/scripts/run-retention-archive.js",
    patterns: ["archive_old_operational_data", "RETENTION_CUTOFF_DAYS"]
  },
  {
    label: "load test",
    file: "apps/mobile-api/scripts/load-test-mobile-api.js",
    patterns: ["LOAD_TEST_USERS", "/api/health/vitals", "/api/safety/phone-analytics"]
  },
  {
    label: "scale docs",
    file: "docs/production-scale-hardening.md",
    patterns: ["Partitioning", "Row-level security", "Object storage", "Queue workers", "Load testing"]
  }
];

const failures = [];
for (const check of checks) {
  const body = read(check.file);
  if (!body) {
    failures.push(`${check.label}: missing ${check.file}`);
    continue;
  }
  for (const pattern of check.patterns) {
    if (!body.includes(pattern)) failures.push(`${check.label}: missing ${pattern}`);
  }
}

if (failures.length) {
  console.error(`Scale hardening audit failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}

console.log("Scale hardening audit passed");
