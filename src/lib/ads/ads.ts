import type {
  AdCreativeRecord,
  AdEventInput,
  AdPlacementReadinessItem,
  AdPlacementResponse,
  AdReadinessSummary
} from "@/lib/domain/ads";
import { getAppEnv } from "@/lib/env";
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

const requiredPlacementKeys: Array<{ key: string; surface: AdPlacementReadinessItem["surface"] }> = [
  { key: "web.discover.top", surface: "web" },
  { key: "app.feed.inline", surface: "mobile" },
  { key: "events.featured.local", surface: "web_mobile" }
];

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

export async function getAdReadinessSummary(): Promise<AdReadinessSummary> {
  const env = getAppEnv();
  const placements = await Promise.all(
    requiredPlacementKeys.map(async ({ key, surface }): Promise<AdPlacementReadinessItem> => {
      try {
        const placement = await getAdPlacement(key);
        const blockers: string[] = [];

        if (placement.disclosureRequired && !placement.disclosureLabel) {
          blockers.push("Sponsored disclosure label is required.");
        }

        if (!placement.creatives.length) {
          blockers.push("No active direct-sold creative is assigned.");
        }

        return {
          placementKey: key,
          surface,
          status: blockers.length ? "empty" : "ready",
          disclosureRequired: placement.disclosureRequired,
          disclosureLabel: placement.disclosureLabel,
          activeCreatives: placement.creatives.length,
          blockers
        };
      } catch (error) {
        return {
          placementKey: key,
          surface,
          status: "missing",
          disclosureRequired: true,
          disclosureLabel: "Sponsored",
          activeCreatives: 0,
          blockers: [error instanceof Error ? error.message : "Placement lookup failed."]
        };
      }
    })
  );
  const googleBackfillConfigured = Boolean(
    env.googleAdsClientId && env.googleAdsClientSecret && env.googleAdsDeveloperToken
  );
  const placementBlockers = placements.flatMap((placement) =>
    placement.blockers.map((blocker) => `${placement.placementKey}: ${blocker}`)
  );
  const blockers = [
    ...placementBlockers,
    ...(googleBackfillConfigured ? [] : ["Google Ads/Ad Manager credentials are not configured; launch direct-sold only."])
  ];
  const directSoldPlacementsReady = placements.filter((placement) => placement.status === "ready").length;

  return {
    generatedAt: new Date().toISOString(),
    status: googleBackfillConfigured && !placementBlockers.length
      ? "ready"
      : directSoldPlacementsReady > 0
        ? "direct_sold_ready"
        : "action_required",
    googleBackfillConfigured,
    directSoldPlacementsReady,
    totalPlacements: placements.length,
    placements,
    blockers,
    nextActions: blockers.length
      ? blockers
      : ["Direct-sold placements and Google backfill are ready for launch monitoring."]
  };
}
