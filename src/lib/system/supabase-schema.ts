import { getAppEnv } from "@/lib/env";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type SchemaTableCheck = {
  table: string;
  requiredFor: string;
  capability: SupabaseCapabilityKey;
  status: "ready" | "missing" | "unchecked";
  rowCount?: number;
  error?: string;
};

type SchemaColumnCheck = {
  table: string;
  column: string;
  requiredFor: string;
  capability: SupabaseCapabilityKey;
  status: "ready" | "missing" | "unchecked";
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

type RequiredColumn = RequiredTable & {
  column: string;
};

export const migrationManifest = [
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
  "20260511010000_public_source_acquisition_staging.sql",
  "20260511020000_community_memberships.sql",
  "20260511030000_expert_profiles.sql",
  "20260511033000_community_invitations_topics.sql",
  "20260511102000_import_idempotency.sql",
  "20260511104000_claim_verification_operations.sql",
  "20260511105000_ad_event_idempotency.sql",
  "20260511110000_newsroom_rss_idempotency.sql",
  "20260511111500_api_key_last_used.sql",
  "20260511134452_add_webhook_signing_ciphertext.sql",
  "20260511141401_scheduled_worker_runs.sql",
  "20260511142434_approved_current_site_source.sql",
  "20260511202000_event_reminder_followups.sql",
  "20260512034500_event_attendance_capture.sql",
  "20260513191500_provider_claim_document_reviews.sql",
  "20260514070334_newsroom_content_performance_metrics.sql",
  "20260514073400_newsletter_delivery_attempts.sql",
  "20260514085800_policy_override_workflow.sql",
  "20260514110500_extracted_entity_review_assignments.sql",
  "20260514132000_vendor_feed_connections.sql",
  "20260514143000_source_adapter_manifests.sql",
  "20260514153500_provider_website_parser_rule_overrides.sql",
  "20260514190000_policy_review_assignments.sql",
  "20260515021000_consumer_profile_sessions.sql",
  "20260515022000_app_device_registrations.sql",
  "20260515023100_care_circle_invite_delivery.sql",
  "20260515024200_community_digest_deliveries.sql",
  "20260515025100_expert_answer_rankings.sql",
  "20260515030200_local_trust_scores.sql",
  "20260515032200_event_followup_compositions.sql"
];

export const migrationCapabilities: Record<string, { capability: SupabaseCapabilityKey; summary: string }> = {
  "20260510000000_senior_platform_foundation.sql": {
    capability: "directory",
    summary: "Core provider directory, locations, categories, provenance, and family inquiry foundation."
  },
  "20260510001000_aggregation_pipeline.sql": {
    capability: "aggregation",
    summary: "Import batches, crawl jobs, extracted entity staging, matching, and data quality review."
  },
  "20260510002000_claim_verification_engine.sql": {
    capability: "claims",
    summary: "Provider claims, verification attempts, and claim outreach workflows."
  },
  "20260510003000_events_marketplace.sql": {
    capability: "events",
    summary: "Events, RSVPs, sponsored promotions, and event analytics foundation."
  },
  "20260510004000_community_feed.sql": {
    capability: "community",
    summary: "Community posts, comments, reports, and moderation controls."
  },
  "20260510005000_ad_placement_engine.sql": {
    capability: "ads",
    summary: "Ad placements, direct-sold campaigns, creatives, impressions, and clicks."
  },
  "20260510006000_marketing_growth_engine.sql": {
    capability: "growth",
    summary: "Campaigns, AI generations, content assets, and provider growth tools."
  },
  "20260510007000_reviews_reputation.sql": {
    capability: "reviews",
    summary: "Reviews, review responses, review requests, and reputation scores."
  },
  "20260510008000_ai_newsroom.sql": {
    capability: "newsroom",
    summary: "Content sources, newsroom intake, article drafts, published articles, and derivatives."
  },
  "20260510154824_mobile_stickiness.sql": {
    capability: "community",
    summary: "Mobile saved providers, care circles, comparison lists, care notes, tours, and notifications."
  },
  "20260515021000_consumer_profile_sessions.sql": {
    capability: "community",
    summary: "Signed senior and caregiver app sessions bound to consumer profile records."
  },
  "20260515022000_app_device_registrations.sql": {
    capability: "community",
    summary: "Session-bound mobile and web app device registration for push-token delivery readiness."
  },
  "20260515023100_care_circle_invite_delivery.sql": {
    capability: "community",
    summary: "Care-circle family invite delivery status, payload evidence, and queue/manual handoff metadata."
  },
  "20260515024200_community_digest_deliveries.sql": {
    capability: "community",
    summary: "Community topic digest delivery jobs, internal queue evidence, and recipient device counts."
  },
  "20260515025100_expert_answer_rankings.sql": {
    capability: "community",
    summary: "Audited verified-expert ranking snapshots for senior-care question routing."
  },
  "20260515030200_local_trust_scores.sql": {
    capability: "community",
    summary: "Local community trust score snapshots from community, expert, feed, subscription, and moderation signals."
  },
  "20260510160122_provider_growth_subscriptions.sql": {
    capability: "growth",
    summary: "Growth plans, contract subscriptions, and feature entitlements."
  },
  "20260510183000_mobile_provider_portal_completion.sql": {
    capability: "directory",
    summary: "Provider portal profile updates, audits, and claimed listing operations."
  },
  "20260510184500_open_api_platform.sql": {
    capability: "openApi",
    summary: "API clients, keys, partner access, and webhook subscriptions."
  },
  "20260510193500_webhook_delivery_worker.sql": {
    capability: "openApi",
    summary: "Webhook delivery queue, attempts, retries, and audit events."
  },
  "20260510210500_review_request_campaigns.sql": {
    capability: "reviews",
    summary: "Consent-gated review request campaigns and recipient send tracking."
  },
  "20260510220000_dual_funnel_leads.sql": {
    capability: "leadIntake",
    summary: "Family inquiries, operator demos, and free listing lead intake."
  },
  "20260511001000_review_moderation_sentiment.sql": {
    capability: "reviews",
    summary: "Review moderation cases and sentiment scoring."
  },
  "20260511010000_public_source_acquisition_staging.sql": {
    capability: "aggregation",
    summary: "Public-source acquisition staging, enriched provider fields, and image review metadata."
  },
  "20260511020000_community_memberships.sql": {
    capability: "community",
    summary: "Local community memberships, roles, and active member discovery."
  },
  "20260511030000_expert_profiles.sql": {
    capability: "community",
    summary: "Verified local expert profile submission, review, and public discovery."
  },
  "20260511033000_community_invitations_topics.sql": {
    capability: "community",
    summary: "Community invitation delivery queue and local topic subscriptions."
  },
  "20260511102000_import_idempotency.sql": {
    capability: "aggregation",
    summary: "Skipped-record accounting and source-record indexes for idempotent listing imports."
  },
  "20260511104000_claim_verification_operations.sql": {
    capability: "claims",
    summary: "Indexes for idempotent claim verification attempts and expiry operations."
  },
  "20260511105000_ad_event_idempotency.sql": {
    capability: "ads",
    summary: "Unique request-level dedupe indexes for ad impressions and clicks."
  },
  "20260511110000_newsroom_rss_idempotency.sql": {
    capability: "newsroom",
    summary: "RSS inbox dedupe indexes for source URLs and source-title review."
  },
  "20260511111500_api_key_last_used.sql": {
    capability: "openApi",
    summary: "Partner API key last-used tracking for integration monitoring and security review."
  },
  "20260511134452_add_webhook_signing_ciphertext.sql": {
    capability: "openApi",
    summary: "Encrypted webhook signing secret storage for deliverable partner webhooks."
  },
  "20260511141401_scheduled_worker_runs.sql": {
    capability: "policy",
    summary: "Scheduled backend worker run history for cron observability and launch operations."
  },
  "20260511142434_approved_current_site_source.sql": {
    capability: "aggregation",
    summary: "Approved owner-controlled current-site public listing source for policy-gated acquisition."
  },
  "20260511202000_event_reminder_followups.sql": {
    capability: "events",
    summary: "Event reminder and post-event follow-up queues for provider event retention automation."
  },
  "20260512034500_event_attendance_capture.sql": {
    capability: "events",
    summary: "Event attendance capture and no-show tracking for RSVP conversion analytics."
  },
  "20260515032200_event_followup_compositions.sql": {
    capability: "events",
    summary: "Provider-facing event follow-up composition snapshots with merge fields and recommended segments."
  },
  "20260513191500_provider_claim_document_reviews.sql": {
    capability: "claims",
    summary: "Auditable provider claim document review decisions tied to license-document verification attempts."
  },
  "20260514070334_newsroom_content_performance_metrics.sql": {
    capability: "newsroom",
    summary: "Article, newsletter, and derivative performance metrics for editorial optimization."
  },
  "20260514073400_newsletter_delivery_attempts.sql": {
    capability: "newsroom",
    summary: "Newsletter delivery attempts, provider payload previews, send blockers, and sent evidence."
  },
  "20260514085800_policy_override_workflow.sql": {
    capability: "policy",
    summary: "Policy approval requests and override evidence for governed launch actions."
  },
  "20260514110500_extracted_entity_review_assignments.sql": {
    capability: "aggregation",
    summary: "Owner assignment and SLA tracking for extracted entity review queue decisions."
  },
  "20260514132000_vendor_feed_connections.sql": {
    capability: "aggregation",
    summary: "Vendor feed contract, credential reference, and field mapping readiness metadata."
  },
  "20260514143000_source_adapter_manifests.sql": {
    capability: "aggregation",
    summary: "CMS, state, and owner-controlled source adapter file manifest checksum and mapping readiness."
  },
  "20260514153500_provider_website_parser_rule_overrides.sql": {
    capability: "aggregation",
    summary: "Governed source-specific provider website parser thresholds and keyword overrides."
  },
  "20260514190000_policy_review_assignments.sql": {
    capability: "policy",
    summary: "Reviewer ownership and SLA due dates for legal, expert, and policy review checks."
  }
};

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
  { table: "extracted_entity_review_assignments", requiredFor: "Extracted entity review owner and SLA tracking", capability: "aggregation" },
  { table: "vendor_feed_connections", requiredFor: "Vendor feed credential and mapping readiness", capability: "aggregation" },
  { table: "source_adapter_manifests", requiredFor: "CMS and state source adapter file manifest readiness", capability: "aggregation" },
  { table: "provider_website_parser_rule_overrides", requiredFor: "Source-specific provider website parser rule tuning", capability: "aggregation" },
  { table: "extracted_entity_images", requiredFor: "Public-source image staging review", capability: "aggregation" },
  { table: "entity_match_candidates", requiredFor: "Duplicate detection", capability: "aggregation" },
  { table: "provider_claims", requiredFor: "Free listing claim workflow", capability: "claims" },
  { table: "provider_verification_attempts", requiredFor: "Claim verification workflow", capability: "claims" },
  { table: "provider_claim_document_reviews", requiredFor: "License document review decisions", capability: "claims" },
  { table: "provider_outreach_sequences", requiredFor: "Claim outreach queue", capability: "claims" },
  { table: "events", requiredFor: "Provider events marketplace", capability: "events" },
  { table: "event_rsvps", requiredFor: "Family event RSVP capture", capability: "events" },
  { table: "event_reminders", requiredFor: "Event reminder automation", capability: "events" },
  { table: "event_followups", requiredFor: "Post-event follow-up automation", capability: "events" },
  { table: "event_followup_compositions", requiredFor: "Provider event follow-up composer", capability: "events" },
  { table: "event_attendance", requiredFor: "Event attendance and no-show capture", capability: "events" },
  { table: "communities", requiredFor: "Local community groups", capability: "community" },
  { table: "consumer_profiles", requiredFor: "Signed senior and caregiver app sessions", capability: "community" },
  { table: "app_device_registrations", requiredFor: "Mobile push token registration", capability: "community" },
  { table: "community_memberships", requiredFor: "Local community membership graph", capability: "community" },
  { table: "community_invitations", requiredFor: "Community invitation delivery", capability: "community" },
  { table: "community_topic_subscriptions", requiredFor: "Local topic subscriptions", capability: "community" },
  { table: "community_digest_deliveries", requiredFor: "Community digest delivery jobs", capability: "community" },
  { table: "community_posts", requiredFor: "Community feed", capability: "community" },
  { table: "expert_profiles", requiredFor: "Verified local expert profiles", capability: "community" },
  { table: "expert_answer_rankings", requiredFor: "Expert answer routing and score audit", capability: "community" },
  { table: "local_trust_scores", requiredFor: "Local trust score snapshots", capability: "community" },
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
  { table: "content_performance_metrics", requiredFor: "Newsroom content performance reporting", capability: "newsroom" },
  { table: "newsletter_delivery_attempts", requiredFor: "Newsletter provider send audit", capability: "newsroom" },
  { table: "api_clients", requiredFor: "Open API clients", capability: "openApi" },
  { table: "webhook_subscriptions", requiredFor: "Open API webhooks", capability: "openApi" },
  { table: "webhook_deliveries", requiredFor: "Webhook delivery queue", capability: "openApi" },
  { table: "webhook_delivery_attempts", requiredFor: "Webhook retry evidence", capability: "openApi" },
  { table: "policy_checks", requiredFor: "Policy guardrail audit", capability: "policy" },
  { table: "policy_review_assignments", requiredFor: "Policy reviewer ownership and SLA tracking", capability: "policy" },
  { table: "policy_approval_requests", requiredFor: "Policy approval workflow", capability: "policy" },
  { table: "policy_overrides", requiredFor: "Policy override audit evidence", capability: "policy" },
  { table: "audit_events", requiredFor: "Operational audit trail", capability: "policy" },
  { table: "scheduled_worker_runs", requiredFor: "Scheduled worker observability", capability: "policy" }
];

const requiredColumns: RequiredColumn[] = [
  { table: "import_batches", column: "skipped_records", requiredFor: "Idempotent import batch accounting", capability: "aggregation" },
  { table: "provider_verification_attempts", column: "expires_at", requiredFor: "Claim verification expiry worker", capability: "claims" },
  { table: "provider_verification_attempts", column: "attempt_payload", requiredFor: "Claim verification evidence audit", capability: "claims" },
  { table: "care_circle_members", column: "invite_delivery_status", requiredFor: "Care-circle family invite delivery jobs", capability: "community" },
  { table: "care_circle_members", column: "invite_delivery_payload", requiredFor: "Care-circle invite payload evidence", capability: "community" },
  { table: "ad_impressions", column: "request_id", requiredFor: "Ad impression dedupe", capability: "ads" },
  { table: "ad_clicks", column: "request_id", requiredFor: "Ad click dedupe", capability: "ads" },
  { table: "news_items", column: "source_url", requiredFor: "RSS source URL dedupe", capability: "newsroom" },
  { table: "published_articles", column: "approval_payload", requiredFor: "Editorial approval audit", capability: "newsroom" },
  { table: "content_performance_metrics", column: "metric_payload", requiredFor: "Newsroom metric attribution and audit metadata", capability: "newsroom" },
  { table: "newsletter_delivery_attempts", column: "payload_preview", requiredFor: "Newsletter provider payload audit", capability: "newsroom" },
  { table: "api_keys", column: "last_used_at", requiredFor: "Partner API key usage monitoring", capability: "openApi" },
  { table: "webhook_subscriptions", column: "signing_secret_ciphertext", requiredFor: "Partner webhook request signing", capability: "openApi" },
  { table: "review_responses", column: "provider_id", requiredFor: "Provider-owned review responses", capability: "reviews" }
];

async function withSchemaProbeTimeout<T>(operation: PromiseLike<T>, label: string, timeoutMs = 3500): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      Promise.resolve(operation),
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function summarizeCapabilities(tableChecks: SchemaTableCheck[], columnChecks: SchemaColumnCheck[]) {
  const tableSummary = requiredTables.reduce(
    (summary, table) => {
      const check = tableChecks.find((item) => item.table === table.table);
      const current = summary[table.capability] ?? {
        key: table.capability,
        status: "ready",
        requiredTables: 0,
        readyTables: 0,
        missingTables: [],
        uncheckedTables: [],
        requiredColumns: 0,
        readyColumns: 0,
        missingColumns: [],
        uncheckedColumns: [],
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
        requiredColumns: number;
        readyColumns: number;
        missingColumns: string[];
        uncheckedColumns: string[];
        totalRows: number;
      }
    >
  );

  return requiredColumns.reduce((summary, column) => {
    const check = columnChecks.find((item) => item.table === column.table && item.column === column.column);
    const current = summary[column.capability] ?? {
      key: column.capability,
      status: "ready" as const,
      requiredTables: 0,
      readyTables: 0,
      missingTables: [],
      uncheckedTables: [],
      requiredColumns: 0,
      readyColumns: 0,
      missingColumns: [],
      uncheckedColumns: [],
      totalRows: 0
    };

    current.requiredColumns += 1;

    if (check?.status === "ready") {
      current.readyColumns += 1;
    } else if (check?.status === "missing") {
      current.status = "schema_action_required";
      current.missingColumns.push(`${column.table}.${column.column}`);
    } else {
      current.status = current.status === "schema_action_required" ? current.status : "unchecked";
      current.uncheckedColumns.push(`${column.table}.${column.column}`);
    }

    summary[column.capability] = current;
    return summary;
  }, tableSummary);
}

async function checkTable({ table, requiredFor, capability }: RequiredTable): Promise<SchemaTableCheck> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { table, requiredFor, capability, status: "unchecked" };
  }

  let result: { count: number | null; error: { message: string } | null };

  try {
    result = await withSchemaProbeTimeout(
      supabase.from(table).select("*", { count: "exact", head: true }).limit(0),
      `Supabase table probe ${table}`
    );
  } catch (error) {
    return {
      table,
      requiredFor,
      capability,
      status: "unchecked",
      error: error instanceof Error ? error.message : "Supabase table probe timed out"
    };
  }

  const { count, error } = result;

  if (error) {
    return { table, requiredFor, capability, status: "missing", error: error.message };
  }

  return { table, requiredFor, capability, status: "ready", rowCount: count ?? 0 };
}

async function checkColumn({ table, column, requiredFor, capability }: RequiredColumn): Promise<SchemaColumnCheck> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return { table, column, requiredFor, capability, status: "unchecked" };
  }

  let result: { error: { message: string } | null };

  try {
    result = await withSchemaProbeTimeout(
      supabase.from(table).select(column, { head: true }).limit(0),
      `Supabase column probe ${table}.${column}`
    );
  } catch (error) {
    return {
      table,
      column,
      requiredFor,
      capability,
      status: "unchecked",
      error: error instanceof Error ? error.message : "Supabase column probe timed out"
    };
  }

  const { error } = result;

  if (error) {
    return { table, column, requiredFor, capability, status: "missing", error: error.message };
  }

  return { table, column, requiredFor, capability, status: "ready" };
}

export async function getSupabaseSchemaReadiness() {
  const env = getAppEnv();
  const configured = Boolean(env.supabaseUrl && env.supabaseServiceRoleKey);
  const [tableChecks, columnChecks] = await Promise.all([
    Promise.all(requiredTables.map((item) => checkTable(item))),
    Promise.all(requiredColumns.map((item) => checkColumn(item)))
  ]);
  const missing = tableChecks.filter((item) => item.status === "missing");
  const unchecked = tableChecks.filter((item) => item.status === "unchecked");
  const missingColumns = columnChecks.filter((item) => item.status === "missing");
  const uncheckedColumns = columnChecks.filter((item) => item.status === "unchecked");
  const capabilitySummary = summarizeCapabilities(tableChecks, columnChecks);
  const blockedCapabilities = Object.values(capabilitySummary)
    .filter((capability) => capability.status === "schema_action_required")
    .map((capability) => capability.key);

  return {
    generatedAt: new Date().toISOString(),
    status: !configured
      ? "not_configured"
      : missing.length || missingColumns.length
        ? "schema_action_required"
        : unchecked.length || uncheckedColumns.length
          ? "schema_unchecked"
          : "ready",
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
    columnSummary: {
      required: columnChecks.length,
      ready: columnChecks.filter((item) => item.status === "ready").length,
      missing: missingColumns.length,
      unchecked: uncheckedColumns.length
    },
    capabilitySummary,
    blockedCapabilities,
    tableChecks,
    columnChecks,
    nextActions: !configured
      ? [
          "Set NEXT_PUBLIC_SUPABASE_URL in Vercel and local env.",
          "Set NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel and local env.",
          "Set SUPABASE_SERVICE_ROLE_KEY as a server-only secret.",
          "Run Supabase migrations before public launch."
        ]
      : missing.length || missingColumns.length
        ? ["Apply pending migrations or repair missing tables before launch.", "Re-run this endpoint after migration."]
        : unchecked.length || uncheckedColumns.length
          ? ["Supabase schema probes timed out or could not complete; verify database connectivity and re-run readiness."]
        : []
  };
}

function migrationPath(file: string) {
  return path.join(process.cwd(), "supabase", "migrations", file);
}

function extractTouchedTables(sql: string) {
  const matches = [...sql.matchAll(/\b(?:create|alter)\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi)];
  return Array.from(new Set(matches.map((match) => match[1]).filter(Boolean))).sort();
}

export async function getSupabaseMigrationPlan() {
  const env = getAppEnv();
  const schema = await getSupabaseSchemaReadiness();
  const migrations = migrationManifest.map((file, index) => {
    const filePath = migrationPath(file);
    const exists = existsSync(filePath);
    const sql = exists ? readFileSync(filePath, "utf8") : "";
    const touchedTables = extractTouchedTables(sql);
    const metadata = migrationCapabilities[file];

    return {
      order: index + 1,
      file,
      exists,
      capability: metadata?.capability ?? "policy",
      summary: metadata?.summary ?? "Platform database migration.",
      touchedTables,
      requiredTablesCovered: requiredTables
        .filter((table) => touchedTables.includes(table.table))
        .map((table) => table.table)
    };
  });
  const missingFiles = migrations.filter((migration) => !migration.exists).map((migration) => migration.file);
  const capabilityCoverage = Object.values(
    migrations.reduce(
      (summary, migration) => {
        const current = summary[migration.capability] ?? {
          capability: migration.capability,
          migrations: 0,
          requiredTablesCovered: new Set<string>()
        };

        current.migrations += 1;
        migration.requiredTablesCovered.forEach((table) => current.requiredTablesCovered.add(table));
        summary[migration.capability] = current;
        return summary;
      },
      {} as Record<SupabaseCapabilityKey, { capability: SupabaseCapabilityKey; migrations: number; requiredTablesCovered: Set<string> }>
    )
  ).map((item) => ({
    capability: item.capability,
    migrations: item.migrations,
    requiredTablesCovered: item.requiredTablesCovered.size
  }));

  return {
    generatedAt: new Date().toISOString(),
    status: missingFiles.length
      ? "missing_migration_files"
      : !schema.configured
        ? "not_configured"
        : schema.status === "ready"
          ? "ready"
          : "apply_migrations",
    configured: schema.configured,
    connection: schema.connection,
    migrationCount: migrations.length,
    missingFiles,
    migrations,
    capabilityCoverage,
    commandPlan: [
      "Confirm production Supabase project and backups.",
      "Run Supabase migrations in order from supabase/migrations.",
      "Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in Vercel.",
      "Re-run /api/v1/system/supabase-schema and confirm missing tables is 0.",
      "Run a dry-run public-source acquisition batch before live ingestion."
    ],
    ownerParkedItems: [
      ...(env.supabaseUrl ? [] : ["Production Supabase URL is not configured."]),
      ...(env.supabaseAnonKey ? [] : ["Production Supabase anon key is not configured."]),
      ...(env.supabaseServiceRoleKey ? [] : ["Production Supabase service role key is not configured."])
    ]
  };
}
