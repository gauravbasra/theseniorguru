import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { seedProviders } from "@/lib/data/seed";

export async function listProviders() {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedProviders;
  }

  const { data, error } = await supabase
    .from("providers")
    .select(
      "id,name,slug,status,phone,website_url,confidence_score,provider_locations(city,state),provider_source_records(source_url,fetched_at,confidence_score,data_sources(name))"
    )
    .in("status", ["verified_by_source", "claimed", "verified", "growth_partner"])
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Provider query failed: ${error.message}`);
  }

  return (data ?? []).map((provider) => {
    const location = provider.provider_locations?.[0];
    const source = provider.provider_source_records?.[0];
    const sourceData = Array.isArray(source?.data_sources) ? source?.data_sources[0] : source?.data_sources;

    return {
      id: provider.id,
      name: provider.name,
      slug: provider.slug,
      status: provider.status,
      categories: [],
      city: location?.city ?? "Unknown",
      state: location?.state ?? "US",
      phone: provider.phone ?? undefined,
      websiteUrl: provider.website_url ?? undefined,
      confidenceScore: Number(provider.confidence_score ?? 0),
      source: {
        name: sourceData?.name ?? "Provider inventory",
        url: source?.source_url ?? undefined,
        fetchedAt: source?.fetched_at ?? new Date().toISOString(),
        confidence: Number(source?.confidence_score ?? provider.confidence_score ?? 0)
      }
    };
  });
}

export async function getProviderById(id: string) {
  const providers = await listProviders();
  return providers.find((provider) => provider.id === id || provider.slug === id) ?? null;
}
