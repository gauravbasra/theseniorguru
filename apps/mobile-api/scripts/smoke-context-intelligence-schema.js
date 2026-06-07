#!/usr/bin/env node

const { Pool } = require("pg");

const requiredTables = [
  "resident_places",
  "resident_location_timeline",
  "resident_place_visits",
  "resident_routines",
  "environment_observations",
  "environment_alerts",
  "mobility_context_snapshots",
  "social_contact_snapshots",
  "transportation_context_decisions",
  "guru_context_signals",
  "guru_daily_guidance"
];

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const result = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = ANY($1)
       ORDER BY table_name`,
      [requiredTables]
    );
    const existing = new Set(result.rows.map(row => row.table_name));
    const missing = requiredTables.filter(table => !existing.has(table));
    if (missing.length) {
      throw new Error(`Missing context intelligence tables: ${missing.join(", ")}`);
    }
    console.log(`Context intelligence schema smoke passed (${requiredTables.length} tables)`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
