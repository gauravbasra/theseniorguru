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
  { label: "Providers API", href: "/api/v1/providers", method: "GET", owner: "public" },
  { label: "Categories API", href: "/api/v1/categories", method: "GET", owner: "public" },
  { label: "Location search API", href: "/api/v1/locations/search", method: "GET", owner: "public" },
  { label: "Events API", href: "/api/v1/events", method: "GET", owner: "public" },
  { label: "Family inquiry API", href: "/api/v1/inquiries", method: "POST", owner: "family" },
  { label: "Free listing API", href: "/api/v1/operator/free-listing-requests", method: "POST", owner: "provider" },
  { label: "Operator demo API", href: "/api/v1/operator/demo-requests", method: "POST", owner: "provider" },
  { label: "Admin leads API", href: "/api/v1/admin/leads", method: "GET", owner: "admin" },
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
  { label: "Readiness API", href: "/api/v1/system/readiness", method: "GET", owner: "admin" },
  { label: "Launch checklist API", href: "/api/v1/system/launch-checklist", method: "GET", owner: "admin" },
  { label: "Supabase schema API", href: "/api/v1/system/supabase-schema", method: "GET", owner: "admin" },
  { label: "Deployment API", href: "/api/v1/system/deployment", method: "GET", owner: "admin" },
  { label: "Aggregation readiness API", href: "/api/v1/admin/aggregation-readiness", method: "GET", owner: "admin" },
  { label: "Import launch plan API", href: "/api/v1/admin/import-launch-plan", method: "GET", owner: "admin" },
  { label: "Import batch requeue API", href: "/api/v1/admin/import-batches/demo/requeue", method: "POST", owner: "admin" },
  { label: "Ad readiness API", href: "/api/v1/admin/ad-readiness", method: "GET", owner: "admin" },
  { label: "Ad placements admin API", href: "/api/v1/admin/ads/placements", method: "GET", owner: "admin" },
  { label: "Ad creative admin API", href: "/api/v1/admin/ads/creatives", method: "POST", owner: "admin" },
  { label: "Crawl jobs API", href: "/api/v1/admin/crawl-jobs", method: "GET", owner: "admin" },
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
  { label: "API audit events API", href: "/api/v1/admin/api-audit-events", method: "GET", owner: "admin" },
  { label: "Newsroom inbox API", href: "/api/v1/admin/newsroom/inbox", method: "GET", owner: "admin" },
  { label: "Newsroom sources API", href: "/api/v1/admin/newsroom/sources", method: "GET", owner: "admin" },
  { label: "Newsroom RSS import API", href: "/api/v1/admin/newsroom/rss/import", method: "POST", owner: "admin" },
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
