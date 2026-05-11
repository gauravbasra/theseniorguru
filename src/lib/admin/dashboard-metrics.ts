import { getAdCampaignReporting } from "@/lib/ads/ads";
import { previewCurrentSiteRealListings } from "@/lib/aggregation/public-source-acquisition";
import { listLeadQueue } from "@/lib/leads";
import { listProviders } from "@/lib/providers";
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
  const [product, launchChecklist, leadQueue, adReporting, providers, listingPreview] = await Promise.all([
    getProductMap(),
    getLaunchChecklist(),
    listLeadQueue(),
    getAdCampaignReporting(),
    listProviders(),
    previewCurrentSiteRealListings({ maxRecords: 25 })
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
    sourceCoverage: listingPreview.sourceCoverage,
    routeHealth,
    headlineNumbers: {
      totalProviders: providers.length,
      totalLeads: leadQueue.total,
      backendRoutes: product.pillars.reduce((sum, pillar) => sum + pillar.backendRoutes.length, 0),
      requiredTables: product.pillars.reduce((sum, pillar) => sum + pillar.requiredTables.length, 0)
    }
  };
}
