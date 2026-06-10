import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL;
}

export function getPostgresPool() {
  if (pool) return pool;

  const connectionString = databaseUrl();
  if (!connectionString) return null;

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes("sslmode=require") ? undefined : { rejectUnauthorized: false }
  });

  return pool;
}

export async function queryPostgres<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  const client = getPostgresPool();
  if (!client) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not configured. Refusing to serve fake business portal data.");
  }

  return client.query<T>(sql, params);
}
