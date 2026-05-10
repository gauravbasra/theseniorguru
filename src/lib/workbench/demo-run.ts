import { checkProviderFeature } from "@/lib/billing/entitlements";
import { createGrowthSubscription, listGrowthPlans } from "@/lib/billing/growth-subscriptions";
import { createCampaign } from "@/lib/campaigns/campaigns";
import { scoreEntityMatchCandidates } from "@/lib/aggregation/entity-matching";
import { runImportBatch } from "@/lib/aggregation/import-worker";
import { createEventPromotion } from "@/lib/events/event-promotions";
import { getEventAnalytics } from "@/lib/events/event-analytics";
import { createCareCircle, saveProvider } from "@/lib/mobile/stickiness";
import { getSystemReadiness } from "@/lib/system/readiness";

export async function runFounderWorkbenchDemo() {
  const providerId = "seed-cottages-dayton-place";
  const eventId = "seed-denver-caregiver-workshop";
  const userKey = "founder-demo-user";

  const [
    readiness,
    plans,
    importDryRun,
    matchResult,
    savedProvider,
    careCircle,
    subscription,
    entitlement,
    campaign,
    eventPromotion,
    eventAnalytics
  ] = await Promise.all([
    Promise.resolve(getSystemReadiness()),
    listGrowthPlans(),
    runImportBatch("pending-import-demo", {
      dryRun: true,
      records: [
        {
          name: "Aurora Senior Day Center",
          city: "Aurora",
          state: "CO",
          websiteUrl: "https://example.com/aurora-senior-day",
          categories: ["Adult Day Care"],
          confidenceScore: 0.74
        },
        {
          name: "Incomplete Care Listing",
          state: "CO"
        }
      ]
    }),
    scoreEntityMatchCandidates("seed-extracted-denver-care"),
    saveProvider({
      userKey,
      providerId,
      notes: "Founder demo shortlist",
      tags: ["memory-care", "tour"]
    }),
    createCareCircle({
      ownerUserKey: userKey,
      name: "Mom care planning",
      city: "Denver",
      state: "CO",
      goals: { timeline: "30 days", priority: "safe tour shortlist" }
    }),
    createGrowthSubscription({
      providerId,
      planKey: "growth_starter",
      termMonths: 6,
      autoRenews: true,
      contractPayload: { source: "founder_workbench_demo" }
    }),
    checkProviderFeature(providerId, "ai_seo"),
    createCampaign({
      providerId,
      campaignType: "local_seo",
      name: "Denver local SEO demo campaign",
      objective: "Rank for local senior care discovery",
      channels: ["seo", "social"]
    }),
    createEventPromotion({
      eventId,
      budgetCents: 25000,
      placementKey: "events.featured.local",
      activate: false
    }),
    getEventAnalytics(eventId)
  ]);

  return {
    ranAt: new Date().toISOString(),
    readiness,
    plans,
    importDryRun,
    matchResult,
    savedProvider,
    careCircle,
    subscription,
    entitlement,
    campaign,
    eventPromotion,
    eventAnalytics
  };
}

