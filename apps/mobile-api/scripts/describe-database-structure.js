const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "../../..");
const schemaPath = path.join(__dirname, "..", "schema.sql");
const migrationsDir = path.join(__dirname, "..", "migrations");
const outputPath = process.argv[2] || path.join(repoRoot, "outputs", "tsg-database-structure.md");

function readSqlFiles() {
  const files = [schemaPath];
  if (fs.existsSync(migrationsDir)) {
    for (const file of fs.readdirSync(migrationsDir).filter(name => name.endsWith(".sql")).sort()) {
      files.push(path.join(migrationsDir, file));
    }
  }
  return files.map(file => ({ file, sql: fs.readFileSync(file, "utf8") }));
}

function parseTables(sql) {
  const tables = [];
  const regex = /CREATE TABLE IF NOT EXISTS\s+([a-zA-Z0-9_]+)\s*\(([\s\S]*?)\n\);/gi;
  let match;
  while ((match = regex.exec(sql))) {
    const [, name, body] = match;
    const columns = body
      .split(/\n/)
      .map(line => line.trim().replace(/,$/, ""))
      .filter(Boolean)
      .filter(line => !/^(PRIMARY|UNIQUE|CHECK|CONSTRAINT|FOREIGN)\b/i.test(line))
      .map(line => line.split(/\s+/).slice(0, 3).join(" "));
    tables.push({ name, columns });
  }
  return tables;
}

function parseIndexes(sql) {
  const indexes = [];
  const regex = /CREATE INDEX IF NOT EXISTS\s+([a-zA-Z0-9_]+)\s+ON\s+([a-zA-Z0-9_]+)\s*\(([^;]+)\);/gi;
  let match;
  while ((match = regex.exec(sql))) {
    indexes.push({ name: match[1], table: match[2], columns: match[3].replace(/\s+/g, " ").trim() });
  }
  return indexes;
}

const mergedSql = readSqlFiles().map(item => item.sql).join("\n\n");
const tables = Array.from(new Map(parseTables(mergedSql).map(table => [table.name, table])).values()).sort((a, b) => a.name.localeCompare(b.name));
const indexes = Array.from(new Map(parseIndexes(mergedSql).map(index => [index.name, index])).values()).sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name));

const domains = [
  ["Identity and access", ["users", "sessions", "trusted_connections", "trusted_invites", "consent_records", "health_visibility_permissions"]],
  ["Resident care", ["residents", "resident_diagnoses", "resident_allergies", "resident_mobility_profiles", "resident_cognitive_support_profiles", "medications", "medication_inventory_events", "medication_refill_requests"]],
  ["Safety and health telemetry", ["safety_telemetry", "resident_safe_zones", "safety_events", "health_consents", "health_vitals", "wearable_devices", "wearable_telemetry", "wearable_connections"]],
  ["Messaging and notifications", ["circle_messages", "circle_call_requests", "resident_messages", "notifications", "notification_delivery_attempts"]],
  ["Services, rides, and commerce", ["businesses", "business_approvals", "subscriptions", "services", "leads", "bookings", "ride_provider_configs", "support_order_provider_configs", "support_orders", "stripe_webhook_events"]],
  ["Community and Guru", ["community_posts", "community_event_rsvps", "guru_conversations", "guru_tasks", "guru_scan_intents", "guru_scans", "guru_memories", "guru_calendar_events", "guru_story_sessions", "guru_music_sessions"]],
  ["Onboarding and verification", ["onboarding_sessions", "identity_evidence", "senior_onboarding_profiles", "senior_health_onboarding", "device_permission_grants", "music_connections", "trust_circle_onboarding", "trust_circle_messaging_rules", "business_onboarding_profiles", "business_service_catalog", "business_availability_rules", "business_service_areas", "business_lead_rules"]],
  ["Audit", ["audit_logs"]]
];

let markdown = `# TheSeniorGuru Database Structure\n\nGenerated from \`apps/mobile-api/schema.sql\` and \`apps/mobile-api/migrations/*.sql\`.\n\n`;

markdown += "## Domain Map\n\n";
for (const [domain, names] of domains) {
  const existing = names.filter(name => tables.some(table => table.name === name));
  if (!existing.length) continue;
  markdown += `### ${domain}\n\n`;
  for (const name of existing) markdown += `- \`${name}\`\n`;
  markdown += "\n";
}

markdown += "## Tables\n\n";
for (const table of tables) {
  markdown += `### ${table.name}\n\n`;
  for (const column of table.columns.slice(0, 24)) markdown += `- \`${column}\`\n`;
  if (table.columns.length > 24) markdown += `- ... ${table.columns.length - 24} more column lines\n`;
  markdown += "\n";
}

markdown += "## Indexes\n\n";
for (const index of indexes) markdown += `- \`${index.name}\` on \`${index.table}\` (${index.columns})\n`;

markdown += `\n## How Information Is Saved\n\n`;
markdown += `- Authentication creates \`users\` and \`sessions\`; API requests identify the current user from the bearer token.\n`;
markdown += `- A senior user owns a \`residents\` row. Trusted people connect through \`trusted_connections\` with scoped permissions.\n`;
markdown += `- Medication actions write \`medications\`, \`medication_inventory_events\`, \`medication_refill_requests\`, \`notifications\`, and \`audit_logs\`.\n`;
markdown += `- Native identity capture stores metadata in \`identity_evidence\`; raw photo/video bytes must move to object storage before production launch.\n`;
markdown += `- Health/wearable setup writes \`health_consents\`, \`wearable_connections\`, \`wearable_devices\`, \`health_vitals\`, and \`wearable_telemetry\`.\n`;
markdown += `- Safety sensor events write \`safety_telemetry\`, create \`safety_events\`, enqueue \`notifications\`, and record \`audit_logs\`.\n`;
markdown += `- Ride/service actions write \`bookings\`, \`leads\`, pricing/payment/fulfillment metadata, and audit events.\n`;
markdown += `- Community posts and event interest write \`community_posts\` and \`community_event_rsvps\`.\n`;

markdown += `\n## Scale Architecture Assessment\n\n`;
markdown += `Current strengths:\n\n`;
markdown += `- Core entities are relational and user/resident scoped.\n`;
markdown += `- High-use read paths have resident/user/status/time indexes.\n`;
markdown += `- Hot telemetry tables now have time + resident indexes for recent-feed queries.\n`;
markdown += `- Audit, notifications, safety, health, and wearable data are separated from profile tables.\n\n`;
markdown += `Not enough yet for millions of installs:\n\n`;
markdown += `- No declared table partitioning yet for \`audit_logs\`, \`notifications\`, \`safety_telemetry\`, \`health_vitals\`, or \`wearable_telemetry\`.\n`;
markdown += `- No row-level-security migration exists yet; production API enforces roles in Node, but direct DB/API exposure would need RLS policies.\n`;
markdown += `- Native media metadata is stored, but binary media still needs object storage with signed upload/download URLs.\n`;
markdown += `- Background workers/queues are not fully separated for notification delivery, telemetry ingestion, payment reconciliation, and ride dispatch.\n`;
markdown += `- Multi-region, read replicas, retention policies, archival jobs, and analytical warehouse export are not implemented.\n\n`;
markdown += `Production scale direction:\n\n`;
markdown += `- Partition hot append-only tables monthly by \`created_at\` and keep local indexes per partition.\n`;
markdown += `- Keep OLTP tables normalized by \`user_id\`, \`resident_id\`, \`business_id\`, and status fields; avoid large unbounded JSON-only blobs for critical workflows.\n`;
markdown += `- Add RLS policies or keep all DB access behind trusted server-only service credentials; never expose service-role credentials to mobile clients.\n`;
markdown += `- Move photo/video/object payloads to S3/Supabase Storage/GCS with signed URLs; keep only metadata and storage keys in Postgres.\n`;
markdown += `- Move telemetry/notifications into queue-backed workers and add retention/archive policies before broad release.\n`;

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, markdown);
console.log(outputPath);
