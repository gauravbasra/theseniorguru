import { getAdPlacement } from "@/lib/ads/ads";
import { listCampaigns } from "@/lib/campaigns/campaigns";
import { listProviderClaims } from "@/lib/claims/provider-claims";
import { listEvents } from "@/lib/events/events";
import { listProviders } from "@/lib/providers";

export async function getProviderDashboard() {
  const [providers, claims, campaigns, events, placement] = await Promise.all([
    listProviders(),
    listProviderClaims(),
    listCampaigns(),
    listEvents(),
    getAdPlacement("events.featured.local")
  ]);

  const provider = providers[0] ?? null;
  const providerClaims = provider ? claims.filter((claim) => claim.providerId === provider.id) : [];
  const providerCampaigns = provider ? campaigns.filter((campaign) => campaign.providerId === provider.id) : [];
  const providerEvents = provider ? events.filter((event) => event.providerId === provider.id) : [];

  return {
    provider,
    stats: {
      claimStatus: providerClaims[0]?.status ?? "not_claimed",
      campaigns: providerCampaigns.length,
      events: providerEvents.length,
      adPlacementReady: placement.disclosureRequired
    },
    growthTasks: [
      {
        title: "Claim and verify your profile",
        status: providerClaims.length ? "started" : "recommended",
        href: provider ? `/api/v1/providers/${provider.id}/claim` : "/api/v1/providers"
      },
      {
        title: "Publish a local education event",
        status: providerEvents.length ? "active" : "recommended",
        href: "/api/v1/provider/events"
      },
      {
        title: "Launch an AI local SEO campaign",
        status: providerCampaigns.length ? "active" : "recommended",
        href: "/api/v1/provider/campaigns"
      },
      {
        title: "Use sponsored placements with clear labels",
        status: placement.disclosureRequired ? "ready" : "needs_setup",
        href: "/api/v1/ads/placements/events.featured.local"
      }
    ]
  };
}

