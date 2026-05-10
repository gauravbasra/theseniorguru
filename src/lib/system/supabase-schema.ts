import { getAppEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

type SchemaTableCheck = {
  table: string;
  requiredFor: string;
  status: "ready" | "missing" | "unchecked";
  error?: string;
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
  "20260510220000_dual_funnel_leads.sql"
];

const requiredTables = [
  { table: "providers", requiredFor: "Directory inventory" },
  { table: "provider_locations", requiredFor: "Local SEO and search" },
  { table: "provider_categories", requiredFor: "Care-type search" },
  { table: "provider_source_records", requiredFor: "Source provenance" },
  { table: "provider_claims", requiredFor: "Free listing claim workflow" },
  { table: "provider_verification_attempts", requiredFor: "Claim verification workflow" },
  { table: "provider_outreach_sequences", requiredFor: "Claim outreach queue" },
  { table: "family_inquiries", requiredFor: "Family inquiry capture" },
  { table: "free_listing_requests", requiredFor: "Operator free listing onboarding" },
  { table: "operator_demo_requests", requiredFor: "Operator demo funnel" },
  { table: "import_batches", requiredFor: "Aggregation import jobs" },
  { table: "crawl_jobs", requiredFor: "Crawler control plane" },
  { table: "extracted_entities", requiredFor: "Inventory staging review" },
  { table: "entity_match_candidates", requiredFor: "Duplicate detection" },
  { table: "events", requiredFor: "Provider events marketplace" },
  { table: "community_posts", requiredFor: "Community feed" },
  { table: "ad_placements", requiredFor: "Advertising inventory" },
  { table: "marketing_campaigns", requiredFor: "Growth engine campaigns" },
  { table: "growth_plans", requiredFor: "Paid plan catalog" },
  { table: "provider_growth_subscriptions", requiredFor: "Provider contract subscriptions" },
  { table: "reviews", requiredFor: "Reviews and reputation" },
  { table: "review_request_campaigns", requiredFor: "Review request campaigns" },
  { table: "content_sources", requiredFor: "AI newsroom source intake" },
  { table: "published_articles", requiredFor: "AI newsroom publishing" },
  { table: "api_clients", requiredFor: "Open API clients" },
  { table: "webhook_subscriptions", requiredFor: "Open API webhooks" },
  { table: "webhook_deliveries", requiredFor: "Webhook delivery queue" },
  { table: "webhook_delivery_attempts", requiredFor: "Webhook retry evidence" },
  { table: "policy_checks", requiredFor: "Policy guardrail audit" },
  { table: "audit_events", requiredFor: "Operational audit trail" }
];

async function checkTable(table: string, requiredFor: string): Promise<SchemaTableCheck> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { table, requiredFor, status: "unchecked" };
  }

  const { error } = await supabase.from(table).select("*", { count: "exact", head: true }).limit(0);

  if (error) {
    return { table, requiredFor, status: "missing", error: error.message };
  }

  return { table, requiredFor, status: "ready" };
}

export async function getSupabaseSchemaReadiness() {
  const env = getAppEnv();
  const configured = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
  const tableChecks = await Promise.all(requiredTables.map((item) => checkTable(item.table, item.requiredFor)));
  const missing = tableChecks.filter((item) => item.status === "missing");
  const unchecked = tableChecks.filter((item) => item.status === "unchecked");

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
      unchecked: unchecked.length
    },
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
