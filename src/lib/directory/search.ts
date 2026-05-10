import type { LocationSearchResult, ProviderCategoryRecord, ProviderRecord } from "@/lib/domain/providers";
import { listProviders } from "@/lib/providers";

function categoryKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function matchesQuery(values: string[], query?: string) {
  if (!query) {
    return true;
  }

  const normalized = query.trim().toLowerCase();
  return values.some((value) => value.toLowerCase().includes(normalized));
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export async function listProviderCategories(): Promise<ProviderCategoryRecord[]> {
  const providers = await listProviders();
  const categoryMap = new Map<string, { name: string; providerIds: Set<string>; states: Set<string> }>();

  for (const provider of providers) {
    for (const category of provider.categories) {
      const key = categoryKey(category);
      if (!key) {
        continue;
      }

      const current = categoryMap.get(key) ?? { name: category, providerIds: new Set<string>(), states: new Set<string>() };
      current.providerIds.add(provider.id);
      current.states.add(provider.state);
      categoryMap.set(key, current);
    }
  }

  return Array.from(categoryMap.entries())
    .map(([key, value]) => ({
      key,
      name: value.name,
      providerCount: value.providerIds.size,
      states: uniqueSorted(Array.from(value.states))
    }))
    .sort((a, b) => b.providerCount - a.providerCount || a.name.localeCompare(b.name));
}

export async function searchLocations(input: {
  q?: string;
  state?: string;
  category?: string;
  limit?: number;
}): Promise<LocationSearchResult[]> {
  const providers = await listProviders();
  const normalizedState = input.state?.trim().toUpperCase();
  const normalizedCategory = input.category?.trim().toLowerCase();
  const limit = Math.max(1, Math.min(50, input.limit ?? 20));

  const filteredProviders = providers.filter((provider) => {
    if (normalizedState && provider.state.toUpperCase() !== normalizedState) {
      return false;
    }

    if (normalizedCategory && !provider.categories.some((category) => category.toLowerCase().includes(normalizedCategory))) {
      return false;
    }

    return matchesQuery([provider.city, provider.state, `${provider.city}, ${provider.state}`], input.q);
  });

  const locationMap = new Map<string, { city: string; state: string; providers: ProviderRecord[] }>();

  for (const provider of filteredProviders) {
    const key = `${provider.city.toLowerCase()}|${provider.state.toLowerCase()}`;
    const current = locationMap.get(key) ?? { city: provider.city, state: provider.state, providers: [] };
    current.providers.push(provider);
    locationMap.set(key, current);
  }

  return Array.from(locationMap.values())
    .map((location) => ({
      city: location.city,
      state: location.state,
      providerCount: location.providers.length,
      categories: uniqueSorted(location.providers.flatMap((provider) => provider.categories))
    }))
    .sort((a, b) => b.providerCount - a.providerCount || a.city.localeCompare(b.city))
    .slice(0, limit);
}
