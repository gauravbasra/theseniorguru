import { getAdReadinessSummary } from "@/lib/ads/ads";
import { getAggregationLaunchReadiness } from "@/lib/aggregation/launch-readiness";
import { getProviderOnboardingReadiness } from "@/lib/claims/provider-onboarding-readiness";
import { getNewsroomReadiness } from "@/lib/newsroom/newsroom";
import { getLinkHealthSummary } from "@/lib/system/link-health";
import { getSystemReadiness } from "@/lib/system/readiness";
import { getSupabaseSchemaReadiness } from "@/lib/system/supabase-schema";

export type LaunchChecklistStatus = "ready" | "action_required" | "blocked" | "parked";

export type LaunchChecklistItem = {
  key: string;
  label: string;
  status: LaunchChecklistStatus;
  blockers: string[];
  nextActions: string[];
  metrics?: Record<string, unknown>;
};

export type LaunchChecklist = {
  generatedAt: string;
  status: "ready" | "action_required" | "blocked";
  checklist: LaunchChecklistItem[];
  blockers: string[];
  nextActions: string[];
  ownerParkedItems: string[];
};

function normalizeStatus(status: string): LaunchChecklistStatus {
  if (status === "ready" || status === "passed" || status === "direct_sold_ready") {
    return "ready";
  }

  if (status === "blocked" || status === "not_configured" || status === "schema_action_required") {
    return "blocked";
  }

  if (status === "parked") {
    return "parked";
  }

  return "action_required";
}

function uniq(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

export async function getLaunchChecklist(): Promise<LaunchChecklist> {
  const [
    system,
    schema,
    linkHealth,
    aggregation,
    ads,
    newsroom,
    onboarding
  ] = await Promise.all([
    Promise.resolve(getSystemReadiness()),
    getSupabaseSchemaReadiness(),
    Promise.resolve(getLinkHealthSummary()),
    getAggregationLaunchReadiness(),
    getAdReadinessSummary(),
    getNewsroomReadiness(),
    getProviderOnboardingReadiness("seed-cottages-dayton-place")
  ]);
  const incompleteSystemChecks = Object.values(system.groups)
    .flatMap((group) => group.checks)
    .filter((check) => check.status === "missing" || check.status === "partial");

  const checklist: LaunchChecklistItem[] = [
    {
      key: "system_config",
      label: "Production configuration",
      status: normalizeStatus(system.overallStatus),
      blockers: incompleteSystemChecks.map((check) => check.action ?? check.label),
      nextActions: incompleteSystemChecks.map((check) => check.action ?? check.label),
      metrics: {
        supabase: system.groups.supabase.status,
        email: system.groups.email.status,
        ads: system.groups.ads.status,
        auth: system.groups.auth.status,
        hosting: system.groups.hosting.status
      }
    },
    {
      key: "supabase_schema",
      label: "Supabase schema and migrations",
      status: normalizeStatus(schema.status),
      blockers: schema.nextActions,
      nextActions: schema.nextActions,
      metrics: schema.tableSummary
    },
    {
      key: "link_health",
      label: "Internal route and API link health",
      status: normalizeStatus(linkHealth.status),
      blockers: linkHealth.results.filter((result) => result.status === "invalid").map((result) => `${result.label}: ${result.reason}`),
      nextActions: linkHealth.results.filter((result) => result.status === "invalid").map((result) => `Repair ${result.href}`),
      metrics: {
        total: linkHealth.total,
        invalidCount: linkHealth.invalidCount
      }
    },
    {
      key: "inventory_aggregation",
      label: "5,000-listing aggregation launch engine",
      status: normalizeStatus(aggregation.status),
      blockers: aggregation.blockers.map((blocker) => blocker.message),
      nextActions: aggregation.nextActions,
      metrics: {
        importedListings: aggregation.progress.importedListings,
        importedPercent: aggregation.progress.importedPercent,
        approvedSources: aggregation.sources.approved,
        unresolvedQualityFlags: aggregation.quality.unresolvedFlags
      }
    },
    {
      key: "advertising",
      label: "Advertising placements and Google backfill",
      status: normalizeStatus(ads.status),
      blockers: ads.blockers,
      nextActions: ads.nextActions,
      metrics: {
        directSoldPlacementsReady: ads.directSoldPlacementsReady,
        totalPlacements: ads.totalPlacements,
        googleBackfillConfigured: ads.googleBackfillConfigured
      }
    },
    {
      key: "newsroom",
      label: "AI newsroom publishing engine",
      status: normalizeStatus(newsroom.status),
      blockers: newsroom.blockers,
      nextActions: newsroom.nextActions,
      metrics: {
        sources: newsroom.sourceSummary.total,
        published: newsroom.articleSummary.published,
        derivatives: newsroom.derivativeSummary.total
      }
    },
    {
      key: "provider_onboarding",
      label: "Provider claim, verification, reputation, and growth onboarding",
      status: normalizeStatus(onboarding.status),
      blockers: onboarding.blockers,
      nextActions: onboarding.nextActions,
      metrics: {
        outreach: onboarding.stages.outreach.status,
        claim: onboarding.stages.claim.status,
        reputation: onboarding.stages.reputation.status,
        growth: onboarding.stages.growth.status
      }
    },
    {
      key: "owner_items",
      label: "Owner approvals parked for launch",
      status: "parked",
      blockers: system.groups.parkedOwnerItems.checks.map((check) => check.action ?? check.label),
      nextActions: system.groups.parkedOwnerItems.checks.map((check) => check.action ?? check.label),
      metrics: {
        parked: system.groups.parkedOwnerItems.checks.length
      }
    }
  ];
  const blockers = uniq(checklist.flatMap((item) => item.blockers));
  const nonOwnerBlockers = checklist
    .filter((item) => item.key !== "owner_items")
    .flatMap((item) => item.blockers);

  return {
    generatedAt: new Date().toISOString(),
    status: checklist.some((item) => item.status === "blocked")
      ? "blocked"
      : nonOwnerBlockers.length
        ? "action_required"
        : "ready",
    checklist,
    blockers,
    nextActions: uniq(checklist.flatMap((item) => item.nextActions)),
    ownerParkedItems: checklist.find((item) => item.key === "owner_items")?.nextActions ?? []
  };
}
