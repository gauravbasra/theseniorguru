export function getOpenApiCatalog() {
  return {
    openapi: "3.1.0",
    info: {
      title: "The Senior Guru API",
      version: "0.1.0",
      description:
        "Public and partner API catalog for provider inventory, events, claims, reviews, community feed, ads, campaigns, policy checks, and newsroom workflows."
    },
    servers: [
      {
        url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      }
    ],
    tags: [
      { name: "Providers" },
      { name: "Claims" },
      { name: "Events" },
      { name: "Community" },
      { name: "Ads" },
      { name: "Campaigns" },
      { name: "Reviews" },
      { name: "Newsroom" },
      { name: "Policy" }
    ],
    paths: {
      "/api/v1/providers": {
        get: { tags: ["Providers"], summary: "List published provider inventory" }
      },
      "/api/v1/providers/{id}": {
        get: { tags: ["Providers"], summary: "Get one provider by id or slug" }
      },
      "/api/v1/providers/{id}/claim": {
        post: { tags: ["Claims"], summary: "Submit a provider claim" }
      },
      "/api/v1/admin/provider-claims/{id}/approve": {
        post: { tags: ["Claims"], summary: "Approve a provider claim and mark provider claimed" }
      },
      "/api/v1/admin/provider-claims/{id}/reject": {
        post: { tags: ["Claims"], summary: "Reject a provider claim with audit notes" }
      },
      "/api/v1/events": {
        get: { tags: ["Events"], summary: "List published events" }
      },
      "/api/v1/events/{id}/rsvp": {
        post: { tags: ["Events"], summary: "RSVP to an event" }
      },
      "/api/v1/app/feed": {
        get: { tags: ["Community"], summary: "Get unified app feed items" }
      },
      "/api/v1/ads/placements/{key}": {
        get: { tags: ["Ads"], summary: "Get ad placement metadata and creatives" }
      },
      "/api/v1/ads/impression": {
        post: { tags: ["Ads"], summary: "Record an ad impression" }
      },
      "/api/v1/ads/click": {
        post: { tags: ["Ads"], summary: "Record an ad click" }
      },
      "/api/v1/provider/campaigns": {
        get: { tags: ["Campaigns"], summary: "List provider campaigns" },
        post: { tags: ["Campaigns"], summary: "Create a provider marketing campaign" }
      },
      "/api/v1/providers/{id}/reviews": {
        get: { tags: ["Reviews"], summary: "List published reviews" },
        post: { tags: ["Reviews"], summary: "Submit a first-party review for moderation" }
      },
      "/api/v1/admin/newsroom/inbox": {
        get: { tags: ["Newsroom"], summary: "List newsroom source items" },
        post: { tags: ["Newsroom"], summary: "Create a newsroom source item" }
      },
      "/api/v1/policy/check": {
        post: { tags: ["Policy"], summary: "Run a policy guardrail check" }
      }
    },
    security: [
      {
        partnerApiKey: []
      }
    ],
    components: {
      securitySchemes: {
        partnerApiKey: {
          type: "apiKey",
          in: "header",
          name: "x-senior-guru-api-key"
        }
      }
    }
  };
}

