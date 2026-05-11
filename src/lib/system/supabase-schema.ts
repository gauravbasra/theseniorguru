import { getAppEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type SchemaTableCheck = {
  table: string;
  requiredFor: string;
  capability: SupabaseCapabilityKey;
  status: "ready" | "missing" | "unchecked";
  rowCount?: number;
  error?: string;
};

type SupabaseCapabilityKey =
  | "directory"
  | "leadIntake"
  | "aggregation"
  | "claims"
  | "events"
  | "community"
  | "ads"
  | "growth"
  | "reviews"
  | "newsroom"
  | "openApi"
  | "policy";

type RequiredTable = {
  table: string;
  requiredFor: string;
  capability: SupabaseCapabilityKey;
};

const migrationManifest = [
  "20260510000000_senior_platform_foundation.sql",
  "20260510001000_aggregation_pipeline.sql",
  "20260510002000_claim_verification_engine.sql",
  "20260510003000_events_marketplace.sql",
  "20260510004000_community_feed.sql",
  "20260510005000_ad_placement_engine.sql",
  "20260510006000_marketing_growth_engine.sql",
  "20260510007000_reviews_reputation.sql",
  "20260510008000_ai_newsroom.sql",
  "20260510154824_mobile_stickiness.sql",
  "20260510160122_provider_growth_subscriptions.sql",
  "20260510183000_mobile_provider_portal_completion.sql",
  "20260510184500_open_api_platform.sql",
  "20260510193500_webhook_delivery_worker.sql",
  "20260510210500_review_request_campaigns.sql",
  "20260510220000_dual_funnel_leads.sql",
  "20260511001000_review_moderation_sentiment.sql",
  "20260511010000_public_source_acquisition_staging.sql"
];

const requiredTables: RequiredTable[] = [
  { table: "providers", requiredFor: "Directory inventory", capability: "directory" },
  { table: "provider_locations", requiredFor: "Local SEO and search", capability: "directory" },
  { table: "provider_categories", requiredFor: "Care-type search", capability: "directory" },
  { table: "provider_source_records", requiredFor: "Source provenance", capability: "directory" },
  { table: "family_inquiries", requiredFor: "Family inquiry capture", capability: "leadIntake" },
  { table: "free_listing_requests", requiredFor: "Operator free listing onboarding", capability: "leadIntake" },
  { table: "operator_demo_requests", requiredFor: "Operator demo funnel", capability: "leadIntake" },
  { table: "import_batches", requiredFor: "Aggregation import jobs", capability: "aggregation" },
  { table: "crawl_jobs", requiredFor: "Crawler control plane", capability: "aggregation" },
  { table: "extracted_entities", requiredFor: "Inventory staging review", capability: "aggregation" },
  { table: "extracted_entity_images", requiredFor: "Public-source image staging review", capability: "aggregation" },
  { table: "entity_match_candidates", requiredFor: "Duplicate detection", capability: "aggregation" },
  { table: "provider_claims", requiredFor: "Free listing claim workflow", capability: "claims" },
  { table: "provider_verification_attempts", requiredFor: "Claim verification workflow", capability: "claims" },
  { table: "provider_outreach_sequences", requiredFor: "Claim outreach queue", capability: "claims" },
  { table: "events", requiredFor: "Provider events marketplace", capability: "events" },
  { table: "community_posts", requiredFor: "Community feed", capability: "community" },
  { table: "ad_placements", requiredFor: "Advertising inventory", capability: "ads" },
  { table: "ad_campaigns", requiredFor: "Direct-sold ad campaigns", capability: "ads" },
  { table: "ad_creatives", requiredFor: "Sponsored ad creative", capability: "ads" },
  { table: "ad_impressions", requiredFor: "Sponsored impression tracking", capability: "ads" },
  { table: "ad_clicks", requiredFor: "Sponsored click tracking", capability: "ads" },
  { table: "marketing_campaigns", requiredFor: "Growth engine campaigns", capability: "growth" },
  { table: "growth_plans", requiredFor: "Paid plan catalog", capability: "growth" },
  { table: "provider_growth_subscriptions", requiredFor: "Provider contract subscriptions", capability: "growth" },
  { table: "reviews", requiredFor: "Reviews and reputation", capability: "reviews" },
  { table: "review_request_campaigns", requiredFor: "Review request campaigns", capability: "reviews" },
  { table: "review_moderation_cases", requiredFor: "Review moderation audit", capability: "reviews" },
  { table: "review_sentiment", requiredFor: "Review sentiment scoring", capability: "reviews" },
  { table: "content_sources", requiredFor: "AI newsroom source intake", capability: "newsroom" },
  { table: "published_articles", requiredFor: "AI newsroom publishing", capability: "newsroom" },
  { table: "api_clients", requiredFor: "Open API clients", capability: "openApi" },
  { table: "webhook_subscriptions", requiredFor: "Open API webhooks", capability: "openApi" },
  { table: "webhook_deliveries", requiredFor: "Webhook delivery queue", capability: "openApi" },
  { table: "webhook_delivery_attempts", requiredFor: "Webhook retry evidence", capability: "openApi" },
  { table: "policy_checks", requiredFor: "Policy guardrail audit", capability: "policy" },
  { table: "audit_events", requiredFor: "Operational audit trail", capability: "policy" }
];

function summarizeCapabilities(tableChecks: SchemaTableCheck[]) {
  return requiredTables.reduce(
    (summary, table) => {
      const check = tableChecks.find((item) => item.table === table.table);
      const current = summary[table.capability] ?? {
        key: table.capability,
        status: "ready",
        requiredTables: 0,
        readyTables: 0,
        missingTables: [],
        uncheckedTables: [],
        totalRows: 0
      };

      current.requiredTables += 1;

      if (check?.status === "ready") {
        current.readyTables += 1;
        current.totalRows += check.rowCount ?? 0;
      } else if (check?.status === "missing") {
        current.status = "schema_action_required";
        current.missingTables.push(table.table);
      } else {
        current.status = current.status === "schema_action_required" ? current.status : "unchecked";
        current.uncheckedTables.push(table.table);
      }

      summary[table.capability] = current;
      return summary;
    },
    {} as Record<
      SupabaseCapabilityKey,
      {
        key: SupabaseCapabilityKey;
        status: "ready" | "schema_action_required" | "unchecked";
        requiredTables: number;
        readyTables: number;
        missingTables: string[];
        uncheckedTables: string[];
        totalRows: number;
      }
    >
  );
}

async function checkTable({ table, requiredFor, capability }: RequiredTable): Promise<SchemaTableCheck> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { table, requiredFor, capability, status: "unchecked" };
  }

  const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(0);

  if (error) {
    return { table, requiredFor, capability, status: "missing", error: error.message };
  }

  return { table, requiredFor, capability, status: "ready", rowCount: count ?? 0 };
}

export async function getSupabaseSchemaReadiness() {
  const env = getAppEnv();
  const configured = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
  const tableChecks = await Promise.all(requiredTables.map((item) => checkTable(item)));
  const missing = tableChecks.filter((item) => item.status === "missing");
  const unchecked = tableChecks.filter((item) => item.status === "unchecked");
  const capabilitySummary = summarizeCapabilities(tableChecks);
  const blockedCapabilities = Object.values(capabilitySummary)
    .filter((capability) => capability.status === "schema_action_required")
    .map((capability) => capability.key);

  return {
    generatedAt: new Date().toISOString(),
    status: !configured ? "not_configured" : missing.length ? "schema_action_required" : "ready",
    configured,
    connection: {
      hasUrl: Boolean(env.supabaseUrl),
      hasAnonKey: Boolean(env.supabaseAnonKey),
      hasServiceRoleKey: Boolean(env.supabaseServiceRoleKey)
    },
    migrationManifest,
    migrationCount: migrationManifest.length,
    tableSummary: {
      required: tableChecks.length,
      ready: tableChecks.filter((item) => item.status === "ready").length,
      missing: missing.length,
      unchecked: unchecked.length,
      totalRows: tableChecks.reduce((sum, item) => sum + (item.rowCount ?? 0), 0)
    },
    capabilitySummary,
    blockedCapabilities,
    tableChecks,
    nextActions: !configured
      ? [
          "Set NEXT_PUBLIC_SUPABASE_URL in Vercel and local env.",
          "Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel and local env.",
          "Set SUPABASE_SERVICE_ROLE_KEY as a server-only secret.",
          "Run Supabase migrations before public launch."
        ]
      : missing.length
        ? ["Apply pending migrations or repair missing tables before launch.", "Re-run this endpoint after migration."]
        : []
  };
}
