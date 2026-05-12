import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { migrationCapabilities, migrationManifest } from "@/lib/system/supabase-schema";

export type SupabaseMigrationBundleFile = {
  order: number;
  file: string;
  exists: boolean;
  capability: string;
  summary: string;
  bytes: number;
  sha256?: string;
  sql?: string;
};

export type SupabaseMigrationBundle = {
  generatedAt: string;
  status: "ready" | "missing_files";
  migrationCount: number;
  totalBytes: number;
  bundleSha256: string;
  includeSql: boolean;
  files: SupabaseMigrationBundleFile[];
  instructions: string[];
};

function migrationPath(file: string) {
  return path.join(process.cwd(), "supabase", "migrations", file);
}

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function getSupabaseMigrationBundle(input: { includeSql?: boolean } = {}): SupabaseMigrationBundle {
  const includeSql = Boolean(input.includeSql);
  const files = migrationManifest.map((file, index) => {
    const filePath = migrationPath(file);
    const exists = existsSync(filePath);
    const sql = exists ? readFileSync(filePath, "utf8") : "";
    const metadata = migrationCapabilities[file];

    return {
      order: index + 1,
      file,
      exists,
      capability: metadata?.capability ?? "policy",
      summary: metadata?.summary ?? "Platform database migration.",
      bytes: Buffer.byteLength(sql, "utf8"),
      sha256: exists ? sha256(sql) : undefined,
      ...(includeSql ? { sql } : {})
    };
  });
  const bundleSql = files
    .filter((file) => file.exists)
    .map((file) => {
      const sql = "sql" in file && typeof file.sql === "string"
        ? file.sql
        : readFileSync(migrationPath(file.file), "utf8");

      return `-- Migration ${file.order}: ${file.file}\n-- Capability: ${file.capability}\n${sql.trim()}\n`;
    })
    .join("\n");
  const missingFiles = files.filter((file) => !file.exists);

  return {
    generatedAt: new Date().toISOString(),
    status: missingFiles.length ? "missing_files" : "ready",
    migrationCount: files.length,
    totalBytes: Buffer.byteLength(bundleSql, "utf8"),
    bundleSha256: sha256(bundleSql),
    includeSql,
    files,
    instructions: [
      "Open Supabase SQL Editor for the production Senior Guru project.",
      "Run the ordered bundle from this endpoint before enabling production import jobs.",
      "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel Production.",
      "Redeploy Vercel, then run /api/v1/admin/supabase-readiness and confirm launchDecision is ready_for_persistent_imports.",
      "Run one small public-source acquisition batch before running the 5,000-listing launch batch."
    ]
  };
}
