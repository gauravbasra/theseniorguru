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
  { label: "Discover", href: "/discover", method: "GET", owner: "public" },
  { label: "Seniors", href: "/seniors", method: "GET", owner: "family" },
  { label: "Operators", href: "/operators", method: "GET", owner: "provider" },
  { label: "Provider console", href: "/provider", method: "GET", owner: "provider" },
  { label: "Admin", href: "/admin", method: "GET", owner: "admin" },
  { label: "OpenAPI", href: "/api/v1/openapi", method: "GET", owner: "admin" },
  { label: "Providers API", href: "/api/v1/providers", method: "GET", owner: "public" },
  { label: "Categories API", href: "/api/v1/categories", method: "GET", owner: "public" },
  { label: "Location search API", href: "/api/v1/locations/search", method: "GET", owner: "public" },
  { label: "Events API", href: "/api/v1/events", method: "GET", owner: "public" },
  { label: "App feed API", href: "/api/v1/app/feed", method: "GET", owner: "family" },
  { label: "Comparison lists API", href: "/api/v1/app/comparison-lists", method: "GET", owner: "family" },
  { label: "Care notes API", href: "/api/v1/app/care-notes", method: "GET", owner: "family" },
  { label: "Tour plans API", href: "/api/v1/app/tour-plans", method: "GET", owner: "family" },
  { label: "Notification preferences API", href: "/api/v1/me/notification-preferences", method: "GET", owner: "family" },
  { label: "Readiness API", href: "/api/v1/system/readiness", method: "GET", owner: "admin" },
  { label: "Deployment API", href: "/api/v1/system/deployment", method: "GET", owner: "admin" },
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
