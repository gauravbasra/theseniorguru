import { seedProviders } from "@/lib/data/seed";

type LinkContract = {
  label: string;
  href: string;
  method: "GET" | "POST" | "PATCH";
  owner: "public" | "admin" | "provider" | "family";
};

export type LinkHealthResult = LinkContract & {
  status: "valid" | "invalid";
  reason?: string;
};

const routeContracts: LinkContract[] = [
  { label: "Home", href: "/", method: "GET", owner: "public" },
  { label: "Robots", href: "/robots.txt", method: "GET", owner: "public" },
  { label: "Sitemap", href: "/sitemap.xml", method: "GET", owner: "public" },
  { label: "Discover", href: "/discover", method: "GET", owner: "public" },
  { label: "Seniors", href: "/seniors", method: "GET", owner: "family" },
  { label: "Operators", href: "/operators", method: "GET", owner: "provider" },
  { label: "Free listing", href: "/operators/free-listing", method: "GET", owner: "provider" },
  { label: "AI occupancy platform", href: "/operators/ai-occupancy-platform", method: "GET", owner: "provider" },
  { label: "Reputation management", href: "/operators/reputation", method: "GET", owner: "provider" },
  { label: "Senior care guides", href: "/articles", method: "GET", owner: "public" },
  {
    label: "Memory care tour questions guide",
    href: "/articles/memory-care-tour-questions-families-should-ask-before-they-feel-rushed",
    method: "GET",
    owner: "public"
  },
  { label: "Denver senior living", href: "/senior-living/co/denver", method: "GET", owner: "public" },
  { label: "Denver assisted living", href: "/senior-care/co/denver/assisted-living", method: "GET", owner: "public" },
  { label: "Provider console", href: "/provider", method: "GET", owner: "provider" },
  { label: "Admin", href: "/admin", method: "GET", owner: "admin" },
  { label: "Owner login", href: "/login", method: "GET", owner: "admin" },
  { label: "Owner session API", href: "/api/v1/auth/session", method: "GET", owner: "admin" },
  { label: "Owner login API", href: "/api/v1/auth/login", method: "POST", owner: "admin" },
  { label: "Owner logout API", href: "/api/v1/auth/logout", method: "POST", owner: "admin" },
  { label: "OpenAPI", href: "/api/v1/openapi", method: "GET", owner: "admin" },
  { label: "Provider verification queue API", href: "/api/v1/admin/provider-verification-queue", method: "GET", owner: "admin" },
  { label: "Provider verification SLA API", href: "/api/v1/admin/provider-verification-sla", method: "GET", owner: "admin" },
  { label: "Provider verification SLA alert API", href: "/api/v1/admin/provider-verification-sla/notify", method: "POST", owner: "admin" },
  { label: "Provider verification delivery readiness API", href: "/api/v1/admin/provider-verification-delivery-readiness", method: "GET", owner: "admin" },
  { label: "Provider profile update queue API", href: "/api/v1/admin/provider-profile-updates", method: "GET", owner: "admin" },
  { label: "Provider profile update status API", href: "/api/v1/provider-portal/providers/seed-cottages-dayton-place/profile-updates", method: "GET", owner: "provider" },
  { label: "Providers API", href: "/api/v1/providers", method: "GET", owner: "public" },
  { label: "Categories API", href: "/api/v1/categories", method: "GET", owner: "public" },
  { label: "Location search API", href: "/api/v1/locations/search", method: "GET", owner: "public" },
  { label: "Events API", href: "/api/v1/events", method: "GET", owner: "public" },
  { label: "Family inquiry API", href: "/api/v1/inquiries", method: "POST", owner: "family" },
  { label: "Free listing API", href: "/api/v1/operator/free-listing-requests", method: "POST", owner: "provider" },
  { label: "Operator demo API", href: "/api/v1/operator/demo-requests", method: "POST", owner: "provider" },
  { label: "Admin leads API", href: "/api/v1/admin/leads", method: "GET", owner: "admin" },
  { label: "Admin dashboard metrics API", href: "/api/v1/admin/dashboard-metrics", method: "GET", owner: "admin" },
  { label: "App feed API", href: "/api/v1/app/feed", method: "GET", owner: "family" },
  { label: "Articles API", href: "/api/v1/articles", method: "GET", owner: "public" },
  {
    label: "Article detail API",
    href: "/api/v1/articles/memory-care-tour-questions-families-should-ask-before-they-feel-rushed",
    method: "GET",
    owner: "public"
  },
  { label: "Comparison lists API", href: "/api/v1/app/comparison-lists", method: "GET", owner: "family" },
  { label: "Care notes API", href: "/api/v1/app/care-notes", method: "GET", owner: "family" },
  { label: "Tour plans API", href: "/api/v1/app/tour-plans", method: "GET", owner: "family" },
  { label: "Notification preferences API", href: "/api/v1/me/notification-preferences", method: "GET", owner: "family" },
  { label: "Community groups API", href: "/api/v1/community/groups", method: "GET", owner: "family" },
  { label: "Community group membership API", href: "/api/v1/community/groups/seed-denver-caregivers/members", method: "GET", owner: "family" },
  {
    label: "Community invitations API",
    href: "/api/v1/community/groups/seed-denver-caregivers/invitations",
    method: "GET",
    owner: "family"
  },
  { label: "Community invitation delivery API", href: "/api/v1/admin/community/invitations/demo/send", method: "POST", owner: "admin" },
  { label: "Community topic subscriptions API", href: "/api/v1/community/topic-subscriptions", method: "GET", owner: "family" },
  { label: "Community experts API", href: "/api/v1/community/experts", method: "GET", owner: "family" },
  { label: "Community expert verification API", href: "/api/v1/admin/community/experts/demo/verify", method: "POST", owner: "admin" },
  { label: "Readiness API", href: "/api/v1/system/readiness", method: "GET", owner: "admin" },
  { label: "Launch checklist API", href: "/api/v1/system/launch-checklist", method: "GET", owner: "admin" },
  { label: "Supabase schema API", href: "/api/v1/system/supabase-schema", method: "GET", owner: "admin" },
  { label: "Supabase migration plan API", href: "/api/v1/system/supabase-migration-plan", method: "GET", owner: "admin" },
  { label: "Deployment API", href: "/api/v1/system/deployment", method: "GET", owner: "admin" },
  { label: "Aggregation readiness API", href: "/api/v1/admin/aggregation-readiness", method: "GET", owner: "admin" },
  { label: "Data sources API", href: "/api/v1/admin/data-sources", method: "GET", owner: "admin" },
  { label: "Data source approval queue API", href: "/api/v1/admin/data-sources/approval-queue", method: "GET", owner: "admin" },
  { label: "Data source approval API", href: "/api/v1/admin/data-sources/demo/approve", method: "POST", owner: "admin" },
  { label: "Data source block API", href: "/api/v1/admin/data-sources/demo/block", method: "POST", owner: "admin" },
  { label: "Import launch plan API", href: "/api/v1/admin/import-launch-plan", method: "GET", owner: "admin" },
  { label: "Launch import source seeding API", href: "/api/v1/admin/import-launch-sources/seed", method: "POST", owner: "admin" },
  { label: "Import adapter readiness API", href: "/api/v1/admin/import-adapters", method: "GET", owner: "admin" },
  { label: "Source adapter import readiness API", href: "/api/v1/admin/source-adapter-imports", method: "GET", owner: "admin" },
  { label: "Source adapter import runner API", href: "/api/v1/admin/source-adapter-imports", method: "POST", owner: "admin" },
  { label: "Source adapter scheduled worker API", href: "/api/v1/admin/source-adapter-imports/worker", method: "POST", owner: "admin" },
  { label: "Source adapter manifest API", href: "/api/v1/admin/source-adapter-manifests", method: "GET", owner: "admin" },
  { label: "Source adapter manifest registration API", href: "/api/v1/admin/source-adapter-manifests", method: "POST", owner: "admin" },
  { label: "Source adapter manifest payload loader API", href: "/api/v1/admin/source-adapter-manifests/load", method: "POST", owner: "admin" },
  { label: "Source adapter signed object fetch API", href: "/api/v1/admin/source-adapter-manifests/fetch", method: "POST", owner: "admin" },
  { label: "Source adapter signed object fetch worker API", href: "/api/v1/admin/source-adapter-manifests/fetch/worker", method: "POST", owner: "admin" },
  { label: "Source adapter storage readiness API", href: "/api/v1/admin/source-adapter-manifests/storage-readiness", method: "GET", owner: "admin" },
  { label: "Vendor feed connections API", href: "/api/v1/admin/vendor-feed-connections", method: "GET", owner: "admin" },
  { label: "Vendor feed import runner API", href: "/api/v1/admin/vendor-feed-imports", method: "POST", owner: "admin" },
  { label: "Vendor feed scheduled worker API", href: "/api/v1/admin/vendor-feed-imports/worker", method: "POST", owner: "admin" },
  { label: "Launch import execution API", href: "/api/v1/admin/import-launch-execution", method: "POST", owner: "admin" },
  { label: "Import batch requeue API", href: "/api/v1/admin/import-batches/demo/requeue", method: "POST", owner: "admin" },
  { label: "Provider website parser rules API", href: "/api/v1/admin/provider-website-parser/rules", method: "GET", owner: "admin" },
  {
    label: "Provider website parser rule audit API",
    href: "/api/v1/admin/provider-website-parser/rules/audit",
    method: "GET",
    owner: "admin"
  },
  {
    label: "Provider website parser rule impact API",
    href: "/api/v1/admin/provider-website-parser/rules/impact",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Provider website parser rule impact attach API",
    href: "/api/v1/admin/provider-website-parser/rules/impact/attach",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Provider website parser rule impact export API",
    href: "/api/v1/admin/provider-website-parser/rules/impact/export",
    method: "GET",
    owner: "admin"
  },
  {
    label: "Provider website parser rule rollback API",
    href: "/api/v1/admin/provider-website-parser/rules/rollback",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Provider website parser rule replacement API",
    href: "/api/v1/admin/provider-website-parser/rules/replace",
    method: "POST",
    owner: "admin"
  },
  { label: "Ad readiness API", href: "/api/v1/admin/ad-readiness", method: "GET", owner: "admin" },
  { label: "Ad placements admin API", href: "/api/v1/admin/ads/placements", method: "GET", owner: "admin" },
  { label: "Ad creative admin API", href: "/api/v1/admin/ads/creatives", method: "POST", owner: "admin" },
  { label: "Ad reporting API", href: "/api/v1/admin/ads/reporting", method: "GET", owner: "admin" },
  { label: "Crawl jobs API", href: "/api/v1/admin/crawl-jobs", method: "GET", owner: "admin" },
  { label: "Provider website parser API", href: "/api/v1/admin/provider-website-parser", method: "GET", owner: "admin" },
  { label: "Data quality flags API", href: "/api/v1/admin/data-quality-flags", method: "GET", owner: "admin" },
  { label: "API clients API", href: "/api/v1/admin/api-clients", method: "GET", owner: "admin" },
  { label: "API client keys API", href: "/api/v1/admin/api-clients/demo/keys", method: "GET", owner: "admin" },
  {
    label: "API key revocation API",
    href: "/api/v1/admin/api-clients/demo/keys/demo-key/revoke",
    method: "POST",
    owner: "admin"
  },
  { label: "Webhook subscriptions API", href: "/api/v1/admin/webhook-subscriptions", method: "GET", owner: "admin" },
  { label: "Webhook deliveries API", href: "/api/v1/admin/webhook-deliveries", method: "GET", owner: "admin" },
  { label: "Webhook retry API", href: "/api/v1/admin/webhook-deliveries/retry", method: "POST", owner: "admin" },
  { label: "Webhook retry scheduler API", href: "/api/v1/admin/webhook-deliveries/scheduler", method: "POST", owner: "admin" },
  { label: "Webhook retry cron API", href: "/api/cron/webhooks", method: "GET", owner: "admin" },
  { label: "Source manifest fetch cron API", href: "/api/cron/source-manifests", method: "GET", owner: "admin" },
  { label: "Import escalation retry cron API", href: "/api/cron/import-escalation-retries", method: "GET", owner: "admin" },
  { label: "API audit events API", href: "/api/v1/admin/api-audit-events", method: "GET", owner: "admin" },
  { label: "API usage analytics API", href: "/api/v1/admin/api-usage-analytics", method: "GET", owner: "admin" },
  { label: "Scheduled worker runs API", href: "/api/v1/admin/scheduled-worker-runs", method: "GET", owner: "admin" },
  { label: "Scheduled worker health API", href: "/api/v1/admin/scheduled-worker-health", method: "GET", owner: "admin" },
  { label: "Scheduled worker alert API", href: "/api/v1/admin/scheduled-worker-alerts", method: "POST", owner: "admin" },
  { label: "Operational audit events API", href: "/api/v1/admin/audit-events", method: "GET", owner: "admin" },
  { label: "Audit event export API", href: "/api/v1/admin/audit-events/export", method: "GET", owner: "admin" },
  { label: "Audit retention preview API", href: "/api/v1/admin/audit-events/retention", method: "GET", owner: "admin" },
  { label: "Audit retention control API", href: "/api/v1/admin/audit-events/retention", method: "POST", owner: "admin" },
  { label: "Policy queue API", href: "/api/v1/admin/policy-queue", method: "GET", owner: "admin" },
  { label: "Policy review assignments API", href: "/api/v1/admin/policy-review-assignments", method: "GET", owner: "admin" },
  { label: "Policy review assignment recorder API", href: "/api/v1/admin/policy-review-assignments", method: "POST", owner: "admin" },
  { label: "Policy overrides API", href: "/api/v1/admin/policy-overrides", method: "GET", owner: "admin" },
  { label: "Policy override expiry API", href: "/api/v1/admin/policy-overrides/expire", method: "POST", owner: "admin" },
  { label: "Policy override decision API", href: "/api/v1/admin/policy-overrides/demo/decide", method: "POST", owner: "admin" },
  { label: "Newsroom inbox API", href: "/api/v1/admin/newsroom/inbox", method: "GET", owner: "admin" },
  { label: "Newsroom sources API", href: "/api/v1/admin/newsroom/sources", method: "GET", owner: "admin" },
  { label: "Newsroom RSS import API", href: "/api/v1/admin/newsroom/rss/import", method: "POST", owner: "admin" },
  { label: "Newsroom RSS cron API", href: "/api/cron/newsroom", method: "GET", owner: "admin" },
  {
    label: "Newsletter delivery preview API",
    href: "/api/v1/admin/newsroom/newsletters/seed-newsletter-family-tour-planning/delivery-preview",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Newsletter delivery send API",
    href: "/api/v1/admin/newsroom/newsletters/seed-newsletter-family-tour-planning/send",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Newsroom performance export API",
    href: "/api/v1/admin/newsroom/performance/export?bucket=week",
    method: "GET",
    owner: "admin"
  },
  { label: "Newsroom readiness API", href: "/api/v1/admin/newsroom/readiness", method: "GET", owner: "admin" },
  { label: "Partner providers API", href: "/api/v1/partner/providers", method: "GET", owner: "provider" },
  { label: "Partner events API", href: "/api/v1/partner/events", method: "GET", owner: "provider" },
  {
    label: "Provider onboarding readiness API",
    href: "/api/v1/admin/provider-onboarding-readiness?providerId=seed-cottages-dayton-place",
    method: "GET",
    owner: "admin"
  },
  { label: "Provider claim status API", href: "/api/v1/provider-portal/claims/demo/status", method: "GET", owner: "provider" },
  { label: "Provider outreach requeue API", href: "/api/v1/admin/provider-outreach/demo/requeue", method: "POST", owner: "admin" },
  {
    label: "Provider claim evidence API",
    href: "/api/v1/provider-portal/claims/demo/verification-evidence",
    method: "POST",
    owner: "provider"
  },
  {
    label: "Provider verification delivery API",
    href: "/api/v1/admin/provider-verification-attempts/demo/send",
    method: "POST",
    owner: "admin"
  },
  { label: "Review request campaigns API", href: "/api/v1/provider/review-request-campaigns", method: "GET", owner: "provider" },
  {
    label: "Review request send API",
    href: "/api/v1/provider/review-request-campaigns/demo/send",
    method: "POST",
    owner: "provider"
  },
  {
    label: "Reputation readiness API",
    href: "/api/v1/provider/reputation-readiness?providerId=seed-cottages-dayton-place",
    method: "GET",
    owner: "provider"
  },
  { label: "Review requests API", href: "/api/v1/provider/review-requests", method: "GET", owner: "provider" },
  { label: "Review moderation queue API", href: "/api/v1/admin/reviews/moderation", method: "GET", owner: "admin" },
  { label: "Review moderation action API", href: "/api/v1/admin/reviews/demo/moderate", method: "POST", owner: "admin" },
  { label: "Review sentiment scoring API", href: "/api/v1/admin/reviews/demo/sentiment", method: "POST", owner: "admin" },
  {
    label: "Review response publish API",
    href: "/api/v1/provider-portal/reviews/demo/responses/publish",
    method: "POST",
    owner: "provider"
  },
  {
    label: "Current-site inventory import",
    href: "/api/v1/admin/current-site-inventory/import",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Extracted entity quality audit",
    href: "/api/v1/admin/extracted-entities/quality-audit",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Extracted entity review queue",
    href: "/api/v1/admin/extracted-entities/review-queue",
    method: "GET",
    owner: "admin"
  },
  {
    label: "Extracted entity review assignment",
    href: "/api/v1/admin/extracted-entities/seed-extracted-denver-care/assignment",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Extracted entity escalation report",
    href: "/api/v1/admin/extracted-entities/escalations",
    method: "GET",
    owner: "admin"
  },
  {
    label: "Extracted entity escalation delivery readiness",
    href: "/api/v1/admin/extracted-entities/escalations/delivery-readiness",
    method: "GET",
    owner: "admin"
  },
  {
    label: "Extracted entity escalation notification",
    href: "/api/v1/admin/extracted-entities/escalations/notify",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Extracted entity escalation delivery callback",
    href: "/api/v1/admin/extracted-entities/escalations/delivery-callback",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Extracted entity escalation retry scheduler",
    href: "/api/v1/admin/extracted-entities/escalations/retry-scheduler",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Extracted entity escalation retry delivery",
    href: "/api/v1/admin/extracted-entities/escalations/retry-delivery",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Public-source acquisition sample run",
    href: "/api/v1/admin/public-source-acquisition/sample-run",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Current-site real listing acquisition",
    href: "/api/v1/admin/public-source-acquisition/current-site-run",
    method: "POST",
    owner: "admin"
  },
  {
    label: "Current-site real listing preview",
    href: "/api/v1/admin/public-source-acquisition/current-site-preview",
    method: "GET",
    owner: "admin"
  }
];

function isInternalGetLink(link: LinkContract) {
  return link.href.startsWith("/") && link.method === "GET";
}

function isInternalPostLink(link: LinkContract) {
  return link.href.startsWith("/") && link.method === "POST";
}

function isInternalPatchLink(link: LinkContract) {
  return link.href.startsWith("/") && link.method === "PATCH";
}

export function getLinkContracts(): LinkContract[] {
  return [
    ...routeContracts,
    ...seedProviders.map((provider) => ({
      label: `Provider profile: ${provider.name}`,
      href: `/providers/${provider.slug}`,
      method: "GET" as const,
      owner: "public" as const
    })),
    ...seedProviders.map((provider) => ({
      label: `Provider contact: ${provider.name}`,
      href: `/api/v1/providers/${provider.id}/contact`,
      method: "POST" as const,
      owner: "family" as const
    })),
    ...seedProviders
      .filter((provider) => provider.websiteUrl)
      .map((provider) => ({
        label: `Provider website: ${provider.name}`,
        href: String(provider.websiteUrl),
        method: "GET" as const,
        owner: "public" as const
      }))
  ];
}

export function checkLinkContracts(): LinkHealthResult[] {
  return getLinkContracts().map((link) => {
    if (!link.href.startsWith("/") && !link.href.startsWith("https://")) {
      return { ...link, status: "invalid", reason: "Link must be internal or absolute HTTPS." };
    }

    if (link.href.includes("example.com")) {
      return { ...link, status: "invalid", reason: "Placeholder links are not allowed in deliverables." };
    }

    if (isInternalGetLink(link) || isInternalPostLink(link) || isInternalPatchLink(link)) {
      return { ...link, status: "valid" };
    }

    return { ...link, status: "valid" };
  });
}

export function getLinkHealthSummary() {
  const results = checkLinkContracts();
  const invalid = results.filter((result) => result.status === "invalid");

  return {
    generatedAt: new Date().toISOString(),
    status: invalid.length ? "failed" : "passed",
    total: results.length,
    invalidCount: invalid.length,
    results
  };
}
