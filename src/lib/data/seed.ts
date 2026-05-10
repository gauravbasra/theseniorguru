import type { DataSourceRecord, ProviderRecord } from "@/lib/domain/providers";

export const seedDataSources: DataSourceRecord[] = [
  {
    id: "seed-cms-care-compare",
    name: "CMS Care Compare",
    sourceType: "cms",
    baseUrl: "https://data.cms.gov/",
    jurisdiction: "US",
    reviewStatus: "approved",
    termsNotes: "Official federal provider data source for launch ingestion planning.",
    approvedAt: "2026-05-10T00:00:00.000Z"
  }
];

export const seedProviders: ProviderRecord[] = [
  {
    id: "seed-denver-memory-care",
    name: "Sample Denver Memory Care",
    slug: "sample-denver-memory-care",
    status: "verified_by_source",
    categories: ["Memory Care", "Assisted Living"],
    city: "Denver",
    state: "CO",
    phone: "303-555-0101",
    websiteUrl: "https://example.com",
    confidenceScore: 0.86,
    source: {
      name: "Seed import placeholder",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.86
    }
  }
];

