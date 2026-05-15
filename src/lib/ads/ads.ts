import type {
  AdCampaignReportingInput,
  AdCampaignReportingPlacement,
  AdCampaignReportingSummary,
  AdCreativeRecord,
  AdEventRecordResult,
  AdEventInput,
  GoogleAdManagerSyncInput,
  GoogleAdManagerSyncResult,
  GoogleAdManagerUnit,
  AdPlacementRecord,
  AdPlacementReadinessItem,
  AdPlacementResponse,
  AdReadinessSummary,
  CreateAdCreativeInput,
  UpsertAdPlacementInput
} from "@/lib/domain/ads";
import { recordAuditEvent } from "@/lib/audit-events";
import { requireProviderFeature } from "@/lib/billing/entitlements";
import { getAppEnv } from "@/lib/env";
import { runPolicyCheck } from "@/lib/policy";
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

type FallbackAdEvent = AdEventInput & {
  type: "impression" | "click";
  recordedAt: string;
};

const fallbackAdEvents: FallbackAdEvent[] = [];
const fallbackGoogleAdUnits: GoogleAdManagerUnit[] = [];
const defaultFrequencyCap = {
  maxImpressions: 3,
  windowHours: 24
};

const requiredPlacementKeys: Array<{ key: string; surface: AdPlacementReadinessItem["surface"] }> = [
  { key: "web.discover.top", surface: "web" },
  { key: "app.feed.inline", surface: "mobile" },
  { key: "events.featured.local", surface: "web_mobile" }
];

function fallbackPlacementRecord(placementKey: string, placement?: AdPlacementResponse): AdPlacementRecord {
  return {
    placementKey,
    name: placementKey.split(".").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" "),
    surface: requiredPlacementKeys.find((item) => item.key === placementKey)?.surface ?? "unknown",
    disclosureRequired: placement?.disclosureRequired ?? true,
    disclosureLabel: placement?.disclosureLabel ?? "Sponsored",
    isActive: true
  };
}

function mapPlacement(row: Record<string, unknown>): AdPlacementRecord {
  return {
    id: String(row.id),
    placementKey: String(row.placement_key),
    name: String(row.name),
    surface: row.surface as AdPlacementRecord["surface"],
    description: row.description ? String(row.description) : undefined,
    disclosureRequired: Boolean(row.requires_disclosure),
    disclosureLabel: String(row.default_disclosure_label),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at)
  };
}

function visitorKeyFromContext(userContext?: Record<string, unknown>) {
  const value = userContext?.visitorKey ?? userContext?.sessionKey ?? userContext?.anonymousId;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function frequencyWindowStart() {
  return new Date(Date.now() - defaultFrequencyCap.windowHours * 60 * 60 * 1000).toISOString();
}

function fallbackImpressionCount(input: {
  placementKey: string;
  adCreativeId?: string;
  visitorKey?: string;
}) {
  if (!input.visitorKey) return 0;
  const start = new Date(frequencyWindowStart()).getTime();

  return fallbackAdEvents.filter((event) => {
    const eventVisitor = visitorKeyFromContext(event.userContext);
    return (
      event.type === "impression" &&
      event.placementKey === input.placementKey &&
      event.adCreativeId === input.adCreativeId &&
      eventVisitor === input.visitorKey &&
      new Date(event.recordedAt).getTime() >= start
    );
  }).length;
}

async function getCreativeImpressionCount(input: {
  placementKey: string;
  adCreativeId?: string;
  visitorKey?: string;
}) {
  if (!input.visitorKey) return 0;
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return fallbackImpressionCount(input);
  }

  let query = supabase
    .from("ad_impressions")
    .select("id", { count: "exact", head: true })
    .eq("placement_key", input.placementKey)
    .gte("created_at", frequencyWindowStart())
    .contains("user_context", { visitorKey: input.visitorKey });

  query = input.adCreativeId ? query.eq("ad_creative_id", input.adCreativeId) : query.is("ad_creative_id", null);

  const { count, error } = await query;

  if (error) {
    throw new Error(`Ad frequency-cap lookup failed: ${error.message}`);
  }

  return count ?? 0;
}

async function isFrequencyCapped(input: AdEventInput) {
  if (!input.adCreativeId) return false;
  const visitorKey = visitorKeyFromContext(input.userContext);

  if (!visitorKey) return false;

  const impressions = await getCreativeImpressionCount({
    placementKey: input.placementKey,
    adCreativeId: input.adCreativeId,
    visitorKey
  });

  return impressions >= defaultFrequencyCap.maxImpressions;
}

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

export async function getAdPlacementForContext(
  placementKey: string,
  userContext: Record<string, unknown> = {}
): Promise<AdPlacementResponse> {
  const placement = await getAdPlacement(placementKey);
  const visitorKey = visitorKeyFromContext(userContext);

  if (!visitorKey || !placement.creatives.length) {
    return {
      ...placement,
      delivery: {
        eligibleCreatives: placement.creatives.length,
        suppressedCreatives: 0,
        frequencyCap: defaultFrequencyCap
      }
    };
  }

  const checks = await Promise.all(
    placement.creatives.map(async (creative) => ({
      creative,
      capped: (await getCreativeImpressionCount({
        placementKey,
        adCreativeId: creative.id,
        visitorKey
      })) >= defaultFrequencyCap.maxImpressions
    }))
  );
  const eligibleCreatives = checks.filter((check) => !check.capped).map((check) => check.creative);

  return {
    ...placement,
    creatives: eligibleCreatives,
    delivery: {
      eligibleCreatives: eligibleCreatives.length,
      suppressedCreatives: checks.length - eligibleCreatives.length,
      frequencyCap: defaultFrequencyCap
    }
  };
}

export async function listAdPlacements(): Promise<AdPlacementRecord[]> {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return Object.entries(seedPlacements).map(([key, placement]) => fallbackPlacementRecord(key, placement));
  }

  const { data, error } = await supabase
    .from("ad_placements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Ad placement list failed: ${error.message}`);
  }

  return (data ?? []).map(mapPlacement);
}

export async function upsertAdPlacement(input: UpsertAdPlacementInput): Promise<AdPlacementRecord> {
  const policy = await runPolicyCheck({
    subjectType: "ad_placement",
    subjectId: input.placementKey,
    actionKey: "upsert_ad_placement",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Ad placement blocked by policy");
  }

  const disclosureLabel = input.disclosureLabel ?? "Sponsored";
  const record: AdPlacementRecord = {
    placementKey: input.placementKey,
    name: input.name,
    surface: input.surface,
    description: input.description,
    disclosureRequired: input.disclosureRequired ?? true,
    disclosureLabel,
    isActive: input.isActive ?? true,
    createdAt: new Date().toISOString()
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    const existing = seedPlacements[input.placementKey]?.creatives ?? [];
    seedPlacements[input.placementKey] = {
      placementKey: input.placementKey,
      disclosureRequired: record.disclosureRequired,
      disclosureLabel,
      creatives: existing
    };
    return record;
  }

  const { data, error } = await supabase
    .from("ad_placements")
    .upsert({
      placement_key: input.placementKey,
      name: input.name,
      surface: input.surface,
      description: input.description,
      requires_disclosure: input.disclosureRequired ?? true,
      default_disclosure_label: disclosureLabel,
      is_active: input.isActive ?? true
    }, { onConflict: "placement_key" })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Ad placement upsert failed: ${error.message}`);
  }

  return mapPlacement(data);
}

export async function createAdCreative(input: CreateAdCreativeInput): Promise<AdCreativeRecord> {
  const entitlementCheck = input.providerId && input.activate !== false
    ? await requireProviderFeature(input.providerId, "campaigns")
    : undefined;
  const policy = await runPolicyCheck({
    subjectType: "ad_creative",
    subjectId: input.placementKey,
    actionKey: "create_sponsored_ad_creative",
    input
  });

  if (policy.decision.startsWith("blocked")) {
    throw new Error(policy.reasons[0] ?? "Ad creative blocked by policy");
  }

  const placement = await getAdPlacement(input.placementKey);
  const disclosureLabel = input.disclosureLabel ?? placement.disclosureLabel ?? "Sponsored";
  const creative: AdCreativeRecord = {
    id: `ad-creative-${Date.now()}`,
    placementKey: input.placementKey,
    headline: input.headline,
    body: input.body,
    imageUrl: input.imageUrl,
    destinationUrl: input.destinationUrl,
    disclosureLabel,
    payload: {
      ...(input.creativePayload ?? {}),
      campaignName: input.campaignName,
      providerId: input.providerId,
      entitlementCheck,
      policyDecision: policy.decision
    }
  };
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    seedPlacements[input.placementKey] = {
      placementKey: input.placementKey,
      disclosureRequired: true,
      disclosureLabel,
      creatives: [creative, ...(seedPlacements[input.placementKey]?.creatives ?? [])]
    };
    return creative;
  }

  const { data: placementRow, error: placementError } = await supabase
    .from("ad_placements")
    .select("id,default_disclosure_label")
    .eq("placement_key", input.placementKey)
    .single();

  if (placementError) {
    throw new Error(`Ad placement lookup failed: ${placementError.message}`);
  }

  const { data: campaign, error: campaignError } = await supabase
    .from("ad_campaigns")
    .insert({
      provider_id: input.providerId,
      name: input.campaignName,
      status: input.activate === false ? "draft" : "active",
      budget_cents: input.budgetCents ?? 0,
      targeting_rules: input.targetingRules ?? {}
    })
    .select("id")
    .single();

  if (campaignError) {
    throw new Error(`Ad campaign creation failed: ${campaignError.message}`);
  }

  const { data, error } = await supabase
    .from("ad_creatives")
    .insert({
      ad_campaign_id: campaign.id,
      placement_id: placementRow.id,
      headline: input.headline,
      body: input.body,
      image_url: input.imageUrl,
      destination_url: input.destinationUrl,
      disclosure_label: disclosureLabel,
      creative_payload: {
        ...(input.creativePayload ?? {}),
        entitlementCheck,
        policyDecision: policy.decision,
        requiredDisclosures: policy.requiredDisclosures
      },
      is_active: input.activate !== false
    })
    .select("id,headline,body,image_url,destination_url,disclosure_label,creative_payload")
    .single();

  if (error) {
    throw new Error(`Ad creative creation failed: ${error.message}`);
  }

  return {
    id: String(data.id),
    placementKey: input.placementKey,
    headline: String(data.headline),
    body: data.body ? String(data.body) : undefined,
    imageUrl: data.image_url ? String(data.image_url) : undefined,
    destinationUrl: data.destination_url ? String(data.destination_url) : undefined,
    disclosureLabel: String(data.disclosure_label),
    payload: data.creative_payload ?? {}
  };
}

function isDuplicateFallbackAdEvent(input: AdEventInput, type: FallbackAdEvent["type"]) {
  return Boolean(input.requestId) && fallbackAdEvents.some(
    (event) =>
      event.type === type &&
      event.placementKey === input.placementKey &&
      event.requestId === input.requestId &&
      event.adCreativeId === input.adCreativeId
  );
}

async function hasSupabaseAdEvent(input: AdEventInput, type: FallbackAdEvent["type"]) {
  if (!input.requestId) {
    return false;
  }

  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    return isDuplicateFallbackAdEvent(input, type);
  }

  const table = type === "impression" ? "ad_impressions" : "ad_clicks";
  let query = supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("placement_key", input.placementKey)
    .eq("request_id", input.requestId);

  query = input.adCreativeId ? query.eq("ad_creative_id", input.adCreativeId) : query.is("ad_creative_id", null);

  const { count, error } = await query;

  if (error) {
    throw new Error(`Ad ${type} duplicate lookup failed: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

function adEventResult(
  input: AdEventInput,
  eventType: FallbackAdEvent["type"],
  recorded: boolean,
  recordedAt?: string,
  suppressionReason?: string
): AdEventRecordResult {
  return {
    recorded,
    duplicate: !recorded && !suppressionReason,
    eventType,
    placementKey: input.placementKey,
    requestId: input.requestId,
    recordedAt,
    suppressed: Boolean(suppressionReason),
    suppressionReason
  };
}

export async function recordAdImpression(input: AdEventInput): Promise<AdEventRecordResult> {
  if (await hasSupabaseAdEvent(input, "impression")) {
    return adEventResult(input, "impression", false);
  }

  if (await isFrequencyCapped(input)) {
    return adEventResult(input, "impression", false, undefined, "frequency_cap_exceeded");
  }

  const recordedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    fallbackAdEvents.push({ ...input, type: "impression", recordedAt });
    return adEventResult(input, "impression", true, recordedAt);
  }

  await supabase.from("ad_impressions").insert({
    ad_creative_id: input.adCreativeId,
    placement_key: input.placementKey,
    request_id: input.requestId,
    user_context: input.userContext ?? {}
  });

  return adEventResult(input, "impression", true, recordedAt);
}

export async function recordAdClick(input: AdEventInput): Promise<AdEventRecordResult> {
  if (await hasSupabaseAdEvent(input, "click")) {
    return adEventResult(input, "click", false);
  }

  const recordedAt = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    fallbackAdEvents.push({ ...input, type: "click", recordedAt });
    return adEventResult(input, "click", true, recordedAt);
  }

  await supabase.from("ad_clicks").insert({
    ad_creative_id: input.adCreativeId,
    placement_key: input.placementKey,
    request_id: input.requestId,
    destination_url: input.destinationUrl,
    user_context: input.userContext ?? {}
  });

  return adEventResult(input, "click", true, recordedAt);
}

function withinReportingWindow(recordedAt: string, filters: AdCampaignReportingInput) {
  const recorded = new Date(recordedAt).getTime();
  const from = filters.from ? new Date(filters.from).getTime() : undefined;
  const to = filters.to ? new Date(filters.to).getTime() : undefined;

  return (!from || recorded >= from) && (!to || recorded <= to);
}

function calculateCtr(clicks: number, impressions: number) {
  return impressions > 0 ? Number((clicks / impressions).toFixed(4)) : 0;
}

function buildNextActions(placements: AdCampaignReportingPlacement[]) {
  const actions: string[] = [];
  const emptyTraffic = placements.filter((placement) => placement.activeCreatives > 0 && placement.impressions === 0);
  const lowCtr = placements.filter((placement) => placement.impressions >= 100 && placement.ctr < 0.005);

  if (emptyTraffic.length) {
    actions.push(`Verify rendering and impression tracking for ${emptyTraffic.map((item) => item.placementKey).join(", ")}.`);
  }

  if (lowCtr.length) {
    actions.push(`Refresh creative or targeting for low-CTR placements: ${lowCtr.map((item) => item.placementKey).join(", ")}.`);
  }

  return actions.length ? actions : ["Ad reporting is collecting measurable placement activity."];
}

export async function getAdCampaignReporting(
  filters: AdCampaignReportingInput = {}
): Promise<AdCampaignReportingSummary> {
  const supabase = getSupabaseAdminClient();
  const placements = (await listAdPlacements()).filter((placement) =>
    filters.placementKey ? placement.placementKey === filters.placementKey : true
  );

  if (!supabase) {
    const reportingPlacements = await Promise.all(
      placements.map(async (placement): Promise<AdCampaignReportingPlacement> => {
        const activeCreatives = (await getAdPlacement(placement.placementKey)).creatives.length;
        const events = fallbackAdEvents.filter((event) =>
          event.placementKey === placement.placementKey && withinReportingWindow(event.recordedAt, filters)
        );
        const impressions = events.filter((event) => event.type === "impression").length;
        const clicks = events.filter((event) => event.type === "click").length;
        const lastActivityAt = events
          .map((event) => event.recordedAt)
          .sort()
          .at(-1);

        return {
          placementKey: placement.placementKey,
          surface: placement.surface,
          activeCreatives,
          impressions,
          clicks,
          ctr: calculateCtr(clicks, impressions),
          lastActivityAt
        };
      })
    );
    const totals = reportingPlacements.reduce(
      (summary, placement) => ({
        placements: summary.placements + 1,
        activeCreatives: summary.activeCreatives + placement.activeCreatives,
        impressions: summary.impressions + placement.impressions,
        clicks: summary.clicks + placement.clicks,
        ctr: 0
      }),
      { placements: 0, activeCreatives: 0, impressions: 0, clicks: 0, ctr: 0 }
    );

    totals.ctr = calculateCtr(totals.clicks, totals.impressions);

    return {
      generatedAt: new Date().toISOString(),
      filters,
      totals,
      placements: reportingPlacements,
      nextActions: buildNextActions(reportingPlacements)
    };
  }

  const from = filters.from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = filters.to ?? new Date().toISOString();
  const reportingPlacements = await Promise.all(
    placements.map(async (placement): Promise<AdCampaignReportingPlacement> => {
      const placementData = await getAdPlacement(placement.placementKey);
      const impressionQuery = supabase
        .from("ad_impressions")
        .select("id,created_at", { count: "exact" })
        .eq("placement_key", placement.placementKey)
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(1);
      const clickQuery = supabase
        .from("ad_clicks")
        .select("id,created_at", { count: "exact" })
        .eq("placement_key", placement.placementKey)
        .gte("created_at", from)
        .lte("created_at", to)
        .limit(1);
      const [{ count: impressions, data: impressionRows, error: impressionError }, { count: clicks, data: clickRows, error: clickError }] =
        await Promise.all([impressionQuery, clickQuery]);

      if (impressionError) {
        throw new Error(`Ad impression reporting failed: ${impressionError.message}`);
      }

      if (clickError) {
        throw new Error(`Ad click reporting failed: ${clickError.message}`);
      }

      const lastActivityAt = [...(impressionRows ?? []), ...(clickRows ?? [])]
        .map((row) => String(row.created_at))
        .sort()
        .at(-1);

      return {
        placementKey: placement.placementKey,
        surface: placement.surface,
        activeCreatives: placementData.creatives.length,
        impressions: impressions ?? 0,
        clicks: clicks ?? 0,
        ctr: calculateCtr(clicks ?? 0, impressions ?? 0),
        lastActivityAt
      };
    })
  );
  const totals = reportingPlacements.reduce(
    (summary, placement) => ({
      placements: summary.placements + 1,
      activeCreatives: summary.activeCreatives + placement.activeCreatives,
      impressions: summary.impressions + placement.impressions,
      clicks: summary.clicks + placement.clicks,
      ctr: 0
    }),
    { placements: 0, activeCreatives: 0, impressions: 0, clicks: 0, ctr: 0 }
  );

  totals.ctr = calculateCtr(totals.clicks, totals.impressions);

  return {
    generatedAt: new Date().toISOString(),
    filters: { ...filters, from, to },
    totals,
    placements: reportingPlacements,
    nextActions: buildNextActions(reportingPlacements)
  };
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
      ? [
          ...blockers,
          "Frequency caps are enforced when visitorKey, sessionKey, or anonymousId is supplied with ad placement/impression calls."
        ]
      : ["Direct-sold placements, Google backfill, disclosures, and frequency caps are ready for launch monitoring."]
  };
}

function normalizeGoogleSyncMode(mode?: GoogleAdManagerSyncInput["mode"]): NonNullable<GoogleAdManagerSyncInput["mode"]> {
  if (mode === "manual_export" || mode === "google_ad_manager") return mode;
  return "preview";
}

function googleAdUnitCode(placementKey: string) {
  return `tsg_${placementKey.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`;
}

async function buildGoogleAdUnit(placement: AdPlacementRecord): Promise<GoogleAdManagerUnit> {
  const response = await getAdPlacement(placement.placementKey);
  const blockers = [
    ...(placement.disclosureRequired && !placement.disclosureLabel ? ["Sponsored disclosure label is required."] : []),
    ...(!placement.isActive ? ["Placement is inactive."] : []),
    ...(!response.creatives.length ? ["No active direct-sold creative is assigned for backfill fallback."] : [])
  ];

  return {
    placementKey: placement.placementKey,
    surface: placement.surface,
    status: blockers.length ? "blocked" : "ready",
    adUnitCode: googleAdUnitCode(placement.placementKey),
    disclosureLabel: placement.disclosureLabel,
    activeCreatives: response.creatives.length,
    payload: {
      placementKey: placement.placementKey,
      adUnitCode: googleAdUnitCode(placement.placementKey),
      surface: placement.surface,
      disclosureLabel: placement.disclosureLabel,
      frequencyCap: defaultFrequencyCap,
      backfillPriority: response.creatives.length ? "direct_sold_first_google_backfill_second" : "google_backfill_blocked_until_direct_sold_ready"
    },
    blockers
  };
}

async function persistGoogleAdUnits(units: GoogleAdManagerUnit[]) {
  const supabase = getSupabaseAdminClient();

  if (!supabase) {
    fallbackGoogleAdUnits.unshift(...units);
    return;
  }

  const { error } = await supabase.from("google_ad_units").upsert(
    units.map((unit) => ({
      placement_key: unit.placementKey,
      ad_unit_code: unit.adUnitCode,
      surface: unit.surface,
      status: unit.status,
      sync_payload: unit.payload,
      blockers: unit.blockers
    })),
    { onConflict: "placement_key" }
  );

  if (error) {
    throw new Error(`Google ad unit sync persistence failed: ${error.message}`);
  }
}

export async function runGoogleAdManagerSync(input: GoogleAdManagerSyncInput = {}): Promise<GoogleAdManagerSyncResult> {
  const mode = normalizeGoogleSyncMode(input.mode);
  const dryRun = input.dryRun ?? mode === "preview";
  const env = getAppEnv();
  const googleBackfillConfigured = Boolean(
    env.googleAdsClientId && env.googleAdsClientSecret && env.googleAdsDeveloperToken
  );
  const placements = (await listAdPlacements()).filter((placement) =>
    input.placementKeys?.length ? input.placementKeys.includes(placement.placementKey) : true
  );
  const units = await Promise.all(placements.map(buildGoogleAdUnit));
  const unitBlockers = units.flatMap((unit) => unit.blockers.map((blocker) => `${unit.placementKey}: ${blocker}`));
  const credentialBlockers = googleBackfillConfigured
    ? []
    : ["Google Ads/Ad Manager credentials are not configured; keep Google sync in manual-export or preview mode."];
  const modeBlockers = mode === "google_ad_manager" ? credentialBlockers : [];
  const blockers = [...unitBlockers, ...modeBlockers];
  const status: GoogleAdManagerSyncResult["status"] = dryRun
    ? "preview"
    : mode === "manual_export"
      ? "manual_export_ready"
      : blockers.length
        ? "blocked"
        : "synced";

  if (!dryRun && (mode === "manual_export" || status === "synced")) {
    await persistGoogleAdUnits(units);
  }

  if (!dryRun) {
    await recordAuditEvent({
      actorId: input.actorId,
      actorType: input.actorId ? "admin" : "system",
      eventType: "ads.google_ad_manager_sync",
      subjectType: "ad_backfill_sync",
      payload: {
        mode,
        status,
        googleBackfillConfigured,
        placementsReviewed: units.length,
        readyUnits: units.filter((unit) => unit.status === "ready").length,
        blockedUnits: units.filter((unit) => unit.status === "blocked").length,
        blockers
      }
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    dryRun,
    mode,
    status,
    googleBackfillConfigured,
    totals: {
      placementsReviewed: units.length,
      readyUnits: units.filter((unit) => unit.status === "ready").length,
      blockedUnits: units.filter((unit) => unit.status === "blocked").length
    },
    units,
    blockers,
    nextActions: blockers.length
      ? [
          ...blockers,
          "Keep direct-sold inventory active and use manual export until Google credentials and ad-unit review are approved."
        ]
      : ["Google ad units are ready for direct-sold-first backfill monitoring."]
  };
}
