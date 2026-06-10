#!/usr/bin/env node
const { Pool } = require("pg");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const cutoffDays = Number(process.env.RETENTION_CUTOFF_DAYS || 180);
const cutoffAt = process.env.RETENTION_CUTOFF_AT || new Date(Date.now() - cutoffDays * 24 * 60 * 60 * 1000).toISOString();
const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  const result = await pool.query(`SELECT archive_old_operational_data($1::timestamptz) AS archived_counts`, [cutoffAt]);
  console.log(JSON.stringify({ cutoffAt, cutoffDays, archivedCounts: result.rows[0]?.archived_counts || {} }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
