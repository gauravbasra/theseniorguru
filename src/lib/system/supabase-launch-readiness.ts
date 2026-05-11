import { getPersistenceStatus } from "@/lib/system/persistence";
import { getSystemReadiness } from "@/lib/system/readiness";
import { getSupabaseMigrationPlan, getSupabaseSchemaReadiness } from "@/lib/system/supabase-schema";

type SupabaseLaunchDecision = "ready_for_persistent_imports" | "schema_action_required" | "credentials_required";

function pct(ready: number, required: number) {
  return required > 0 ? Math.round((ready / required) * 100) : 0;
}

function decideLaunchStatus({
  durableAcrossDeploys,
  schemaStatus,
  migrationStatus
}: {
  durableAcrossDeploys: boolean;
  schemaStatus: string;
  migrationStatus: string;
}): SupabaseLaunchDecision {
  if (!durableAcrossDeploys || schemaStatus === "not_configured" || migrationStatus === "not_configured") {
    return "credentials_required";
  }

  if (schemaStatus !== "ready" || migrationStatus === "apply_migrations" || migrationStatus === "missing_migration_files") {
    return "schema_action_required";
  }

  return "ready_for_persistent_imports";
}

export async function getSupabaseLaunchReadiness() {
  const [schema, migrationPlan] = await Promise.all([
    getSupabaseSchemaReadiness(),
    getSupabaseMigrationPlan()
  ]);
  const persistence = getPersistenceStatus();
  const system = getSystemReadiness();
  const launchDecision = decideLaunchStatus({
    durableAcrossDeploys: persistence.durableAcrossDeploys,
    schemaStatus: schema.status,
    migrationStatus: migrationPlan.status
  });
  const capabilityRows = Object.values(schema.capabilitySummary)
    .map((capability) => ({
      key: capability.key,
      status: capability.status,
      tableProgress: {
        ready: capability.readyTables,
        required: capability.requiredTables,
        percent: pct(capability.readyTables, capability.requiredTables)
      },
      columnProgress: {
        ready: capability.readyColumns,
        required: capability.requiredColumns,
        percent: pct(capability.readyColumns, capability.requiredColumns)
      },
      totalRows: capability.totalRows,
      blockers: [
        ...capability.missingTables.map((table) => `Missing table: ${table}`),
        ...capability.missingColumns.map((column) => `Missing column: ${column}`),
        ...capability.uncheckedTables.map((table) => `Unchecked table: ${table}`),
        ...capability.uncheckedColumns.map((column) => `Unchecked column: ${column}`)
      ].slice(0, 4)
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const nextActions = [
    ...persistence.ownerActions,
    ...schema.nextActions,
    ...migrationPlan.ownerParkedItems,
    ...migrationPlan.commandPlan.slice(0, 2)
  ];

  return {
    generatedAt: new Date().toISOString(),
    launchDecision,
    persistence,
    systemSupabaseStatus: system.groups.supabase.status,
    schema: {
      status: schema.status,
      configured: schema.configured,
      connection: schema.connection,
      tableSummary: schema.tableSummary,
      columnSummary: schema.columnSummary,
      blockedCapabilities: schema.blockedCapabilities,
      capabilityRows
    },
    migrationPlan: {
      status: migrationPlan.status,
      configured: migrationPlan.configured,
      migrationCount: migrationPlan.migrationCount,
      missingFiles: migrationPlan.missingFiles,
      capabilityCoverage: migrationPlan.capabilityCoverage,
      migrations: migrationPlan.migrations.slice(0, 8),
      ownerParkedItems: migrationPlan.ownerParkedItems
    },
    metrics: {
      tableReadinessPercent: pct(schema.tableSummary.ready, schema.tableSummary.required),
      columnReadinessPercent: pct(schema.columnSummary.ready, schema.columnSummary.required),
      migrationFileReadinessPercent: pct(
        migrationPlan.migrationCount - migrationPlan.missingFiles.length,
        migrationPlan.migrationCount
      ),
      blockedCapabilities: schema.blockedCapabilities.length,
      totalRows: schema.tableSummary.totalRows
    },
    nextActions: Array.from(new Set(nextActions)).slice(0, 8)
  };
}
