export type ProviderStatus = "imported" | "verified_by_source" | "claimed" | "verified" | "growth_partner";

export type ProviderRecord = {
  id: string;
  name: string;
  slug: string;
  status: ProviderStatus;
  categories: string[];
  city: string;
  state: string;
  phone?: string;
  websiteUrl?: string;
  source: {
    name: string;
    url?: string;
    fetchedAt: string;
    confidence: number;
  };
};

const seededProviders: ProviderRecord[] = [
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
    source: {
      name: "Seed import placeholder",
      fetchedAt: "2026-05-10T00:00:00.000Z",
      confidence: 0.86
    }
  }
];

export function listProviders() {
  return seededProviders;
}

export function getProviderById(id: string) {
  return seededProviders.find((provider) => provider.id === id || provider.slug === id) ?? null;
}

