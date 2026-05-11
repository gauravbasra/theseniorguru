import type { MetadataRoute } from "next";
import { listPublishedArticles } from "@/lib/newsroom/newsroom";
import { listProviders } from "@/lib/providers";

const canonicalOrigin = "https://theseniorguru.com";
const staticRoutes = [
  "/",
  "/discover",
  "/seniors",
  "/operators",
  "/operators/free-listing",
  "/operators/ai-occupancy-platform",
  "/operators/reputation",
  "/articles"
];

function routeUrl(path: string) {
  return new URL(path, canonicalOrigin).toString();
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const [providers, articles] = await Promise.all([listProviders(), listPublishedArticles()]);
  const now = new Date();
  const localRoutes = new Map<string, { priority: number; changeFrequency: "daily" | "weekly" }>();

  for (const provider of providers) {
    const city = slugify(provider.city);
    const state = provider.state.toLowerCase();

    if (city && state) {
      localRoutes.set(`/senior-living/${state}/${city}`, { priority: 0.78, changeFrequency: "daily" });

      for (const category of provider.categories) {
        localRoutes.set(`/senior-care/${state}/${city}/${slugify(category)}`, {
          priority: 0.76,
          changeFrequency: "daily"
        });
      }
    }
  }

  return [
    ...staticRoutes.map((route) => ({
      url: routeUrl(route),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: route === "/" ? 1 : 0.82
    })),
    ...providers.map((provider) => ({
      url: routeUrl(`/providers/${provider.slug}`),
      lastModified: new Date(provider.source.fetchedAt),
      changeFrequency: "weekly" as const,
      priority: 0.84
    })),
    ...Array.from(localRoutes.entries()).map(([route, meta]) => ({
      url: routeUrl(route),
      lastModified: now,
      changeFrequency: meta.changeFrequency,
      priority: meta.priority
    })),
    ...articles.map((article) => ({
      url: routeUrl(`/articles/${article.slug}`),
      lastModified: article.publishedAt ? new Date(article.publishedAt) : now,
      changeFrequency: "monthly" as const,
      priority: 0.72
    }))
  ];
}

export function buildRobots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/provider", "/workbench", "/api/v1/admin", "/api/v1/provider", "/api/v1/system"]
    },
    sitemap: routeUrl("/sitemap.xml")
  };
}
