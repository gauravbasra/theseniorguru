#!/usr/bin/env node

const { Pool } = require("pg");

const requiredTables = [
  "resident_app_sessions",
  "resident_screen_states",
  "resident_screen_interactions",
  "resident_action_history",
  "resident_notification_preferences",
  "resident_daily_status_snapshots",
  "wellness_score_snapshots",
  "wellness_contributor_snapshots",
  "vital_baselines",
  "vital_monitor_snapshots",
  "family_health_snapshots",
  "risk_assessments",
  "risk_timeline_events",
  "resident_service_matches",
  "transportation_match_options",
  "booking_status_events",
  "booking_messages",
  "support_order_status_events",
  "community_events",
  "community_post_comments",
  "community_post_reactions",
  "companion_mood_checkins",
  "companion_conversations",
  "companion_messages",
  "trusted_circle_activity",
  "resident_page_audit_events"
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
      throw new Error(`Missing resident surface tables: ${missing.join(", ")}`);
    }
    console.log(`Resident surface schema smoke passed (${requiredTables.length} tables)`);
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error.message);
  process.exit(1);
});
