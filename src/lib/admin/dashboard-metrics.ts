import { getAdCampaignReporting } from "@/lib/ads/ads";
import { previewCurrentSiteRealListings } from "@/lib/aggregation/public-source-acquisition";
import { listProviderClaims } from "@/lib/claims/provider-claims";
import { listCommunityPosts } from "@/lib/community/feed";
import { listExpertProfiles } from "@/lib/community/experts";
import { listCommunityGroups } from "@/lib/community/groups";
import { listEvents } from "@/lib/events/events";
import { listLeadQueue } from "@/lib/leads";
import { listApiAuditEvents, listApiClients, listWebhookDeliveries, listWebhookSubscriptions } from "@/lib/openapi/platform";
import { listProviders } from "@/lib/providers";
import { listReviewModerationQueue } from "@/lib/reviews/reviews";
import { listScheduledWorkerRuns } from "@/lib/scheduler/runs";
import { getLaunchChecklist } from "@/lib/system/launch-checklist";
import { getProductMap } from "@/lib/system/product-map";

type ChartDatum = {
  label: string;
  value: number;
  total?: number;
  tone: "green" | "gold" | "rose" | "blue";
};

function percent(value: number, total: number) {
  return total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
}

function parseRangeTarget(value: string | number) {
  if (typeof value === "number") return value;
  const [first] = value.split("-");
  return Number(first) || 0;
}

export async function getAdminDashboardMetrics() {
  const [
    product,
    launchChecklist,
    leadQueue,
    adReporting,
    providers,
    listingPreview,
    scheduledRuns,
    claims,
    reviewQueue,
    events,
    communityGroups,
    communityPosts,
    verifiedExperts,
    apiClients,
    webhookSubscriptions,
    webhookDeliveries,
    apiAuditEvents
  ] = await Promise.all([
    getProductMap(),
    getLaunchChecklist(),
    listLeadQueue(),
    getAdCampaignReporting(),
    listProviders(),
    previewCurrentSiteRealListings({ maxRecords: 25 }),
    listScheduledWorkerRuns({ limit: 10 }),
    listProviderClaims(),
    listReviewModerationQueue({ status: "pending_moderation" }),
    listEvents(),
    listCommunityGroups(),
    listCommunityPosts(),
    listExpertProfiles({ status: "verified" }),
    listApiClients(),
    listWebhookSubscriptions(),
    listWebhookDeliveries(),
    listApiAuditEvents()
  ]);
  const readinessStatusCounts = launchChecklist.checklist.reduce(
    (counts, item) => ({
      ...counts,
      [item.status]: (counts[item.status] ?? 0) + 1
    }),
    {} as Record<string, number>
  );
  const readiness: ChartDatum[] = [
    { label: "Ready", value: readinessStatusCounts.ready ?? 0, tone: "green" },
    { label: "Action", value: readinessStatusCounts.action_required ?? 0, tone: "gold" },
    { label: "Blocked", value: readinessStatusCounts.blocked ?? 0, tone: "rose" },
    { label: "Parked", value: readinessStatusCounts.parked ?? 0, tone: "blue" }
  ];
  const targetImported = Number(product.launchTargets.importedListings);
  const targetEnriched = Number(product.launchTargets.enrichedListings);
  const targetClaimed = Number(product.launchTargets.claimedListings);
  const targetPaid = parseRangeTarget(product.launchTargets.paidBetaProviders);
  const aggregationItem = launchChecklist.checklist.find((item) => item.key === "inventory_aggregation");
  const importedListings = Number(aggregationItem?.metrics?.importedListings ?? providers.length);
  const inventoryProgress: ChartDatum[] = [
    { label: "Imported", value: importedListings, total: targetImported, tone: "green" },
    { label: "Enriched", value: Math.min(providers.length, targetEnriched), total: targetEnriched, tone: "blue" },
    { label: "Claimed", value: leadQueue.byType.free_listing, total: targetClaimed, tone: "gold" },
    { label: "Paid beta", value: leadQueue.byType.operator_demo, total: targetPaid, tone: "rose" }
  ];
  const leadFunnel: ChartDatum[] = [
    { label: "Family inquiries", value: leadQueue.byType.family_inquiry, tone: "green" },
    { label: "Free listings", value: leadQueue.byType.free_listing, tone: "blue" },
    { label: "Demo requests", value: leadQueue.byType.operator_demo, tone: "gold" }
  ];
  const productEngines = product.pillars.map((pillar) => ({
    label: pillar.title
      .replace("Complete Senior Services ", "")
      .replace("Data Aggregation and ", "")
      .replace("Advertising and ", "")
      .replace("AI Newsroom and ", ""),
    routes: pillar.backendRoutes.length,
    tables: pillar.requiredTables.length,
    status: pillar.status
  }));
  const monetization: ChartDatum[] = [
    { label: "Ad placements", value: adReporting.totals.placements, tone: "blue" },
    { label: "Active creatives", value: adReporting.totals.activeCreatives, tone: "green" },
    { label: "Impressions", value: adReporting.totals.impressions, tone: "gold" },
    { label: "Clicks", value: adReporting.totals.clicks, tone: "rose" }
  ];
  const openClaims = claims.filter((claim) => !["approved", "rejected"].includes(claim.status)).length;
  const workerFailures = scheduledRuns.filter((run) => run.status === "failed").length;
  const operationalEngines: ChartDatum[] = [
    { label: "Open claims", value: openClaims, total: Math.max(claims.length, 1), tone: openClaims ? "gold" : "green" },
    { label: "Reviews waiting", value: reviewQueue.length, total: Math.max(reviewQueue.length, 1), tone: reviewQueue.length ? "gold" : "green" },
    { label: "Published events", value: events.filter((event) => ["published", "featured"].includes(event.status)).length, total: Math.max(events.length, 1), tone: "blue" },
    { label: "Community posts", value: communityPosts.length, total: Math.max(communityPosts.length, 1), tone: "green" },
    { label: "Verified experts", value: verifiedExperts.length, total: Math.max(verifiedExperts.length, 1), tone: "blue" },
    { label: "API clients", value: apiClients.filter((client) => client.status === "active").length, total: Math.max(apiClients.length, 1), tone: "green" },
    { label: "Webhooks", value: webhookSubscriptions.filter((subscription) => subscription.status === "active").length, total: Math.max(webhookSubscriptions.length, 1), tone: "blue" },
    { label: "Worker failures", value: workerFailures, total: Math.max(scheduledRuns.length, 1), tone: workerFailures ? "rose" : "green" }
  ];
  const workflowHealth: ChartDatum[] = [
    { label: "Claims", value: claims.length, tone: openClaims ? "gold" : "green" },
    { label: "Reviews", value: reviewQueue.length, tone: reviewQueue.length ? "gold" : "green" },
    { label: "Events", value: events.length, tone: "blue" },
    { label: "Groups", value: communityGroups.length, tone: "green" },
    { label: "Posts", value: communityPosts.length, tone: "gold" },
    { label: "API audit", value: apiAuditEvents.length, tone: "rose" }
  ];
  const routeHealth = {
    valid: product.linkHealth.total - product.linkHealth.invalidCount,
    invalid: product.linkHealth.invalidCount,
    total: product.linkHealth.total,
    percentValid: percent(product.linkHealth.total - product.linkHealth.invalidCount, product.linkHealth.total)
  };

  return {
    generatedAt: new Date().toISOString(),
    readiness,
    inventoryProgress,
    leadFunnel,
    productEngines,
    monetization,
    operationalEngines,
    workflowHealth,
    sourceCoverage: listingPreview.sourceCoverage,
    scheduledRuns,
    webhookDeliveries,
    routeHealth,
    headlineNumbers: {
      totalProviders: providers.length,
      totalLeads: leadQueue.total,
      backendRoutes: product.pillars.reduce((sum, pillar) => sum + pillar.backendRoutes.length, 0),
      requiredTables: product.pillars.reduce((sum, pillar) => sum + pillar.requiredTables.length, 0)
    }
  };
}
