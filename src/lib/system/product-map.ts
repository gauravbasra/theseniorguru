import { listDataSources } from "@/lib/data-sources";
import { listImportBatches } from "@/lib/import-batches";
import { getSystemReadiness } from "@/lib/system/readiness";
import { getLinkHealthSummary } from "@/lib/system/link-health";

type ProductPillar = {
  key: string;
  title: string;
  objective: string;
  audience: string;
  status: "implemented" | "partial" | "planned" | "blocked";
  backendRoutes: string[];
  requiredTables: string[];
  nextBackendWork: string[];
};

const productPillars: ProductPillar[] = [
  {
    key: "directory",
    title: "Complete Senior Services Directory",
    objective: "Give families every legitimate local option, with direct contact and source provenance.",
    audience: "Seniors, family caregivers, providers, local experts",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/providers",
      "GET /api/v1/providers/{id}",
      "POST /api/v1/providers/{id}/claim",
      "POST /api/v1/providers/{id}/contact",
      "GET /api/v1/providers/{id}/reviews",
      "GET /api/v1/categories",
      "GET /api/v1/locations/search",
      "POST /api/v1/inquiries",
      "POST /api/v1/operator/free-listing-requests",
      "GET /api/v1/admin/leads",
      "GET /api/v1/admin/provider-verification-queue",
      "GET /api/v1/admin/provider-verification-sla",
      "POST /api/v1/admin/provider-verification-sla/notify",
      "GET /api/v1/admin/provider-verification-delivery-readiness",
      "GET /api/v1/admin/provider-onboarding-readiness",
      "POST /api/v1/admin/provider-outreach/{id}/requeue",
      "PATCH /api/v1/provider-portal/providers/{id}",
      "GET /api/v1/provider-portal/providers/{id}/profile-updates",
      "GET /api/v1/admin/provider-profile-updates",
      "POST /api/v1/admin/provider-profile-updates/{id}/decide",
      "GET /api/v1/provider-portal/claims/{id}/status",
      "POST /api/v1/provider-portal/claims/{id}/verification-evidence",
      "POST /api/v1/admin/provider-verification-attempts/{id}/send",
      "POST /api/v1/admin/provider-verification-attempts/{id}/code",
      "POST /api/v1/provider-portal/verification-attempts/{id}/confirm-code",
      "POST /api/v1/admin/provider-claims/{id}/document-review",
      "GET /api/v1/provider/profile-completion-assistant"
    ],
    requiredTables: [
      "providers",
      "provider_locations",
      "provider_categories",
      "provider_contacts",
      "family_inquiries",
      "free_listing_requests",
      "operator_demo_requests",
      "provider_source_records",
      "provider_profile_audits"
    ],
    nextBackendWork: ["Provider-facing edit approval status UI", "Transactional email adapter for verification delivery", "Provider claim SLA alert live queue adapter"]
  },
  {
    key: "mobile",
    title: "Mobile App Retention Layer",
    objective: "Make the family/senior app sticky through saved providers, care circles, notes, and feed activity.",
    audience: "Seniors and family caregivers",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/app/feed",
      "GET /api/v1/app/saved-providers",
      "POST /api/v1/app/saved-providers",
      "GET /api/v1/app/care-circles",
      "POST /api/v1/app/care-circles",
      "POST /api/v1/app/care-circles/{id}/members",
      "GET /api/v1/app/comparison-lists",
      "POST /api/v1/app/comparison-lists",
      "POST /api/v1/app/comparison-lists/{id}/providers",
      "GET /api/v1/app/care-notes",
      "POST /api/v1/app/care-notes",
      "GET /api/v1/app/tour-plans",
      "POST /api/v1/app/tour-plans",
      "GET /api/v1/me/notification-preferences",
      "PATCH /api/v1/me/notification-preferences"
    ],
    requiredTables: [
      "consumer_profiles",
      "care_circles",
      "saved_providers",
      "comparison_lists",
      "care_notes",
      "tour_plans",
      "app_notification_preferences"
    ],
    nextBackendWork: ["Mobile auth/session binding", "Device registration and push tokens", "Family invite delivery jobs"]
  },
  {
    key: "community",
    title: "Community Network",
    objective: "Build Nextdoor/Yelp-style local senior community with moderation and safety controls.",
    audience: "Seniors, caregivers, providers, local experts, admins",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/app/feed",
      "GET /api/v1/community/groups",
      "POST /api/v1/community/groups",
      "GET /api/v1/community/groups/{id}/members",
      "POST /api/v1/community/groups/{id}/members",
      "GET /api/v1/community/groups/{id}/invitations",
      "POST /api/v1/community/groups/{id}/invitations",
      "POST /api/v1/admin/community/invitations/{id}/send",
      "GET /api/v1/community/topic-subscriptions",
      "POST /api/v1/community/topic-subscriptions",
      "GET /api/v1/community/experts",
      "POST /api/v1/community/experts",
      "POST /api/v1/admin/community/experts/{id}/verify",
      "POST /api/v1/community/posts",
      "GET /api/v1/community/posts/{id}/comments",
      "POST /api/v1/community/posts/{id}/comments",
      "POST /api/v1/community/reports",
      "POST /api/v1/admin/community/posts/{id}/moderate"
    ],
    requiredTables: [
      "communities",
      "community_memberships",
      "community_invitations",
      "community_topic_subscriptions",
      "community_posts",
      "community_comments",
      "community_reports",
      "moderation_cases",
      "expert_profiles"
    ],
    nextBackendWork: ["Expert answer ranking", "Local trust scoring", "Community digest delivery jobs"]
  },
  {
    key: "events",
    title: "Provider Events Marketplace",
    objective: "Turn provider events into community value and monetizable promotion inventory.",
    audience: "Providers, families, local experts",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/events",
      "GET /api/v1/events/{id}",
      "POST /api/v1/events/{id}/rsvp",
      "POST /api/v1/provider/events",
      "POST /api/v1/provider/events/{id}/promotions",
      "GET /api/v1/provider/events/{id}/analytics",
      "POST /api/v1/provider/events/{id}/attendance",
      "GET /api/v1/provider/events/{id}/automation-report",
      "POST /api/v1/admin/event-automation/run",
      "GET /api/cron/operations"
    ],
    requiredTables: [
      "events",
      "event_hosts",
      "event_rsvps",
      "event_promotions",
      "event_reminders",
      "event_followups",
      "event_attendance"
    ],
    nextBackendWork: ["Reminder delivery provider adapter", "Provider-facing event follow-up composer"]
  },
  {
    key: "growth",
    title: "Marketing Growth Engine",
    objective: "Monetize provider success with AI SEO, social, reviews, chat, voice, events, and campaigns.",
    audience: "Providers and operators",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/provider/growth-plans",
      "POST /api/v1/provider/growth-subscriptions",
      "POST /api/v1/provider/entitlements/check",
      "POST /api/v1/provider/campaigns",
      "POST /api/v1/operator/demo-requests",
      "POST /api/v1/provider/campaigns/{id}/generate",
      "POST /api/v1/provider/campaigns/{id}/publish",
      "POST /api/v1/provider/campaigns/{id}/metrics",
      "GET /api/v1/provider/campaigns/metrics",
      "GET /api/v1/provider/campaigns/optimization-recommendations",
      "GET /api/v1/admin/provider-onboarding-readiness",
      "GET /api/v1/provider/reputation-readiness",
      "GET /api/v1/provider/review-request-campaigns",
      "POST /api/v1/provider/review-request-campaigns",
      "POST /api/v1/provider/review-request-campaigns/{id}/send",
      "GET /api/v1/admin/reviews/moderation",
      "POST /api/v1/admin/reviews/{id}/moderate",
      "POST /api/v1/admin/reviews/{id}/sentiment",
      "POST /api/v1/provider-portal/reviews/{id}/responses/publish"
    ],
    requiredTables: [
      "marketing_campaigns",
      "campaign_creatives",
      "campaign_metrics",
      "ai_generations",
      "content_assets",
      "social_posts",
      "review_campaigns",
      "voice_campaigns",
      "chat_agents"
    ],
    nextBackendWork: ["AI voice assistant adapter", "Review request delivery provider adapter", "Campaign recommendation delivery UI"]
  },
  {
    key: "ads",
    title: "Advertising and Placement Engine",
    objective: "Treat all site/app real estate as monetizable while preserving trust through disclosures.",
    audience: "Providers, advertisers, admins",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/ads/placements/{key}",
      "GET /api/v1/admin/ads/placements",
      "POST /api/v1/admin/ads/placements",
      "POST /api/v1/admin/ads/creatives",
      "GET /api/v1/admin/ads/reporting",
      "GET /api/v1/admin/ad-readiness",
      "POST /api/v1/ads/impression",
      "POST /api/v1/ads/click"
    ],
    requiredTables: [
      "ad_placements",
      "ad_inventory_slots",
      "ad_campaigns",
      "ad_creatives",
      "ad_impressions",
      "ad_clicks",
      "google_ad_units"
    ],
    nextBackendWork: ["Google Ad Manager sync", "Frequency caps", "Provider-facing ad campaign dashboard"]
  },
  {
    key: "aggregation",
    title: "Data Aggregation and Inventory Engine",
    objective: "Reach 5,000+ launch listings through compliant source registry, import, matching, and review.",
    audience: "Platform admins and data operators",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/admin/data-sources",
      "POST /api/v1/admin/data-sources",
      "GET /api/v1/admin/data-sources/approval-queue",
      "POST /api/v1/admin/data-sources/{id}/approve",
      "POST /api/v1/admin/data-sources/{id}/block",
      "POST /api/v1/admin/import-batches/{id}/run",
      "POST /api/v1/admin/import-batches/{id}/requeue",
      "GET /api/v1/admin/extracted-entities",
      "POST /api/v1/admin/extracted-entities/{id}/match",
      "POST /api/v1/admin/extracted-entities/{id}/assignment",
      "POST /api/v1/admin/extracted-entities/quality-audit",
      "GET /api/v1/admin/extracted-entities/review-queue",
      "GET /api/v1/admin/extracted-entities/escalations",
      "GET /api/v1/admin/extracted-entities/escalations/delivery-readiness",
      "POST /api/v1/admin/extracted-entities/escalations/notify",
      "POST /api/v1/admin/extracted-entities/escalations/delivery-callback",
      "POST /api/v1/admin/extracted-entities/{id}/approve",
      "POST /api/v1/admin/current-site-inventory/import",
      "POST /api/v1/admin/public-source-acquisition/current-site-run",
      "POST /api/v1/admin/public-source-acquisition/current-site-preview",
      "GET /api/v1/admin/aggregation-readiness",
      "GET /api/v1/admin/import-launch-plan",
      "POST /api/v1/admin/import-launch-plan",
      "POST /api/v1/admin/import-launch-sources/seed",
      "GET /api/v1/admin/import-adapters",
      "GET /api/v1/admin/source-adapter-imports",
      "POST /api/v1/admin/source-adapter-imports",
      "POST /api/v1/admin/source-adapter-imports/worker",
      "GET /api/v1/admin/source-adapter-manifests",
      "POST /api/v1/admin/source-adapter-manifests",
      "POST /api/v1/admin/source-adapter-manifests/load",
      "GET /api/v1/admin/source-adapter-manifests/storage-readiness",
      "GET /api/v1/admin/vendor-feed-connections",
      "POST /api/v1/admin/vendor-feed-connections",
      "POST /api/v1/admin/vendor-feed-imports",
      "POST /api/v1/admin/vendor-feed-imports/worker",
      "GET /api/v1/admin/import-launch-execution",
      "POST /api/v1/admin/import-launch-execution",
      "GET /api/v1/admin/crawl-jobs",
      "POST /api/v1/admin/crawl-jobs",
      "POST /api/v1/admin/crawl-jobs/{id}/run",
      "GET /api/v1/admin/provider-website-parser",
      "POST /api/v1/admin/provider-website-parser",
      "GET /api/v1/admin/provider-website-parser/rules",
      "POST /api/v1/admin/provider-website-parser/rules",
      "GET /api/v1/admin/provider-website-parser/rules/audit",
      "GET /api/v1/admin/data-quality-flags"
    ],
    requiredTables: [
      "data_sources",
      "crawl_jobs",
      "crawl_pages",
      "extracted_entities",
      "extracted_entity_review_assignments",
      "vendor_feed_connections",
      "source_adapter_manifests",
      "provider_website_parser_rule_overrides",
      "entity_matches",
      "source_field_values",
      "data_quality_flags",
      "import_batches"
    ],
    nextBackendWork: ["Source manifest signed object fetch executor", "Import escalation retry scheduler", "Provider website parser override rollback workflow"]
  },
  {
    key: "reviews",
    title: "Reviews and Reputation",
    objective: "Build trusted reviews and a paid reputation management add-on without fake/gated reviews.",
    audience: "Families, providers, admins",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/providers/{id}/reviews",
      "POST /api/v1/providers/{id}/reviews",
      "POST /api/v1/provider/reviews/{id}/responses/generate",
      "GET /api/v1/provider/review-request-campaigns",
      "POST /api/v1/provider/review-request-campaigns",
      "POST /api/v1/provider/review-request-campaigns/{id}/send",
      "GET /api/v1/provider/reputation-readiness",
      "GET /api/v1/provider/review-requests",
      "POST /api/v1/provider-portal/reviews/{id}/responses/publish"
    ],
    requiredTables: [
      "reviews",
      "review_requests",
      "review_responses",
      "review_moderation_cases",
      "review_sentiment",
      "reputation_scores",
      "external_review_integrations"
    ],
    nextBackendWork: ["External review integrations", "Review moderation dashboard", "Reputation trend analytics"]
  },
  {
    key: "newsroom",
    title: "AI Newsroom and Publishing Engine",
    objective: "Publish original senior-care authority content with sources, approvals, derivatives, and compliance checks.",
    audience: "Founder/editorial team, providers, families, industry readers",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/admin/newsroom/inbox",
      "POST /api/v1/admin/newsroom/inbox",
      "GET /api/v1/admin/newsroom/sources",
      "POST /api/v1/admin/newsroom/sources",
      "POST /api/v1/admin/newsroom/rss/import",
      "POST /api/v1/admin/newsroom/rss/run",
      "POST /api/v1/admin/newsroom/articles",
      "POST /api/v1/admin/newsroom/articles/{id}/approve",
      "POST /api/v1/admin/newsroom/articles/{id}/publish",
      "POST /api/v1/admin/newsroom/articles/{id}/generate-social",
      "POST /api/v1/admin/newsroom/articles/{id}/generate-podcast-brief",
      "GET /api/v1/admin/newsroom/newsletters",
      "POST /api/v1/admin/newsroom/newsletters",
      "POST /api/v1/admin/newsroom/newsletters/{id}/approve",
      "POST /api/v1/admin/newsroom/newsletters/{id}/schedule",
      "POST /api/v1/admin/newsroom/newsletters/{id}/send",
      "POST /api/v1/admin/newsroom/newsletters/{id}/delivery-preview",
      "GET /api/v1/admin/newsroom/performance",
      "POST /api/v1/admin/newsroom/performance",
      "GET /api/v1/admin/newsroom/performance/export",
      "GET /api/v1/admin/newsroom/readiness",
      "GET /api/v1/articles",
      "GET /api/v1/articles/{slug}",
      "GET /api/v1/newsletters/{id}",
      "GET /api/cron/newsroom"
    ],
    requiredTables: [
      "content_sources",
      "rss_feeds",
      "news_items",
      "article_drafts",
      "published_articles",
      "article_reviews",
      "editorial_approvals",
      "podcast_episodes",
      "newsletter_editions",
      "newsletter_delivery_attempts",
      "content_performance_metrics"
    ],
    nextBackendWork: ["Mailjet audience-recipient export and live send approval", "Newsroom cron live-mode approval", "Provider-facing newsletter analytics"]
  },
  {
    key: "policy",
    title: "Policy Gate and Trust Center",
    objective: "Make policy checks non-optional for publishing, ads, imports, outreach, reviews, and AI outputs.",
    audience: "Admins, legal/compliance, providers",
    status: "partial",
    backendRoutes: [
      "POST /api/v1/policy/check",
      "POST /api/v1/auth/login",
      "POST /api/v1/auth/logout",
      "GET /api/v1/auth/session",
      "GET /api/v1/system/link-health",
      "GET /api/v1/system/readiness",
      "GET /api/v1/system/launch-checklist",
      "GET /api/v1/system/supabase-schema",
      "GET /api/v1/system/visual-assets",
      "GET /api/v1/admin/scheduled-worker-runs",
      "GET /api/v1/admin/scheduled-worker-health",
      "GET /api/v1/admin/audit-events",
      "GET /api/v1/admin/policy-queue",
      "GET /api/v1/admin/policy-overrides",
      "POST /api/v1/admin/policy-overrides",
      "POST /api/v1/admin/policy-overrides/expire",
      "POST /api/v1/admin/policy-overrides/{id}/decide",
      "GET /api/cron/operations",
      "GET /api/cron/acquisition",
      "GET /api/cron/newsroom"
    ],
    requiredTables: [
      "policy_rules",
      "policy_checks",
      "policy_decisions",
      "policy_approval_requests",
      "policy_overrides",
      "consent_records",
      "audit_events",
      "scheduled_worker_runs"
    ],
    nextBackendWork: ["Legal reviewer assignment workflow", "Policy reviewer assignment workflow", "Audit retention/export controls", "Cron alert delivery"]
  },
  {
    key: "open-api",
    title: "Open API Platform",
    objective: "Expose approved partner APIs with versioning, docs, audit logs, and webhooks.",
    audience: "Providers, partners, data/event/ad integrations",
    status: "partial",
    backendRoutes: [
      "GET /api/v1/openapi",
      "GET /api/v1/admin/api-clients",
      "POST /api/v1/admin/api-clients",
      "GET /api/v1/admin/api-clients/{id}/keys",
      "POST /api/v1/admin/api-clients/{id}/keys",
      "POST /api/v1/admin/api-clients/{id}/keys/{keyId}/revoke",
      "GET /api/v1/admin/webhook-subscriptions",
      "POST /api/v1/admin/webhook-subscriptions",
      "GET /api/v1/admin/webhook-deliveries",
      "POST /api/v1/admin/webhook-deliveries",
      "POST /api/v1/admin/webhook-deliveries/run",
      "POST /api/v1/admin/webhook-deliveries/retry",
      "POST /api/v1/admin/webhook-deliveries/scheduler",
      "GET /api/v1/admin/api-audit-events",
      "GET /api/v1/partner/providers",
      "GET /api/v1/partner/events",
      "GET /api/cron/webhooks"
    ],
    requiredTables: [
      "api_clients",
      "api_keys",
      "webhook_subscriptions",
      "webhook_deliveries",
      "webhook_delivery_attempts",
      "api_audit_events"
    ],
    nextBackendWork: ["Partner developer docs UI", "Webhook event signing docs", "Partner API usage analytics"]
  }
];

export async function getProductMap() {
  const [dataSources, importBatches] = await Promise.all([listDataSources(), listImportBatches()]);
  const readiness = getSystemReadiness();
  const linkHealth = getLinkHealthSummary();

  return {
    generatedAt: new Date().toISOString(),
    thesis:
      "Community-first senior services network: free listings and direct contact, monetized through growth tools, events, advertising, reviews, AI newsroom, and APIs.",
    slogans: {
      consumer: "Find every senior care and senior life resource near you, not just paid referral partners.",
      provider: "Your listing is free. Your growth engine is paid.",
      market: "No referral commissions. No hidden pay-to-play recommendations. Sponsored content is labeled."
    },
    launchTargets: {
      importedListings: 5000,
      enrichedListings: 1000,
      claimedListings: 100,
      paidBetaProviders: "25-50"
    },
    operationalSummary: {
      readinessStatus: readiness.overallStatus,
      linkHealthStatus: linkHealth.status,
      dataSources: dataSources.length,
      importBatches: importBatches.length,
      implementedPillars: productPillars.filter((pillar) => pillar.status === "implemented").length,
      partialPillars: productPillars.filter((pillar) => pillar.status === "partial").length
    },
    pillars: productPillars,
    readiness,
    linkHealth: {
      status: linkHealth.status,
      total: linkHealth.total,
      invalidCount: linkHealth.invalidCount
    }
  };
}
