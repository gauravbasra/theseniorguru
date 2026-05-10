import type { AdCreativeRecord, AdEventInput, AdPlacementResponse } from "@/lib/domain/ads";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";

const seedPlacements: Record<string, AdPlacementResponse> = {
  "web.discover.top": {
    placementKey: "web.discover.top",
    disclosureRequired: true,
    disclosureLabel: "Sponsored",
    creatives: []
  },
  "app.feed.inline": {
    placementKey: "app.feed.inline",
    disclosureRequired: true,
    disclosureLabel: "Sponsored",
    creatives: []
  },
  "events.featured.local": {
    placementKey: "events.featured.local",
    disclosureRequired: true,
    disclosureLabel: "Sponsored",
    creatives: []
  }
};

export async function getAdPlacement(placementKey: string): Promise<AdPlacementResponse> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return seedPlacements[placementKey] ?? {
      placementKey,
      disclosureRequired: true,
      disclosureLabel: "Sponsored",
      creatives: []
    };
  }

  const { data: placement, error: placementError } = await supabase
    .from("ad_placements")
    .select("id,placement_key,requires_disclosure,default_disclosure_label")
    .eq("placement_key", placementKey)
    .eq("is_active", true)
    .single();

  if (placementError) {
    throw new Error(`Ad placement query failed: ${placementError.message}`);
  }

  const { data: creatives, error: creativeError } = await supabase
    .from("ad_creatives")
    .select("id,headline,body,image_url,destination_url,disclosure_label,creative_payload")
    .eq("placement_id", placement.id)
    .eq("is_active", true)
    .limit(3);

  if (creativeError) {
    throw new Error(`Ad creative query failed: ${creativeError.message}`);
  }

  return {
    placementKey: placement.placement_key,
    disclosureRequired: Boolean(placement.requires_disclosure),
    disclosureLabel: placement.default_disclosure_label,
    creatives: (creatives ?? []).map((creative): AdCreativeRecord => ({
      id: creative.id,
      placementKey,
      headline: creative.headline,
      body: creative.body ?? undefined,
      imageUrl: creative.image_url ?? undefined,
      destinationUrl: creative.destination_url ?? undefined,
      disclosureLabel: creative.disclosure_label,
      payload: creative.creative_payload ?? {}
    }))
  };
}

export async function recordAdImpression(input: AdEventInput) {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    await supabase.from("ad_impressions").insert({
      ad_creative_id: input.adCreativeId,
      placement_key: input.placementKey,
      request_id: input.requestId,
      user_context: input.userContext ?? {}
    });
  }

  return { recorded: true };
}

export async function recordAdClick(input: AdEventInput) {
  const supabase = getSupabaseAdminClient();

  if (supabase) {
    await supabase.from("ad_clicks").insert({
      ad_creative_id: input.adCreativeId,
      placement_key: input.placementKey,
      request_id: input.requestId,
      destination_url: input.destinationUrl,
      user_context: input.userContext ?? {}
    });
  }

  return { recorded: true };
}

