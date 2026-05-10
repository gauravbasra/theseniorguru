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
      { name: "Aggregation" },
      { name: "System" },
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
      "/api/v1/admin/provider-claims/{id}/verification-attempts": {
        get: { tags: ["Claims"], summary: "List verification attempts for a provider claim" },
        post: { tags: ["Claims"], summary: "Create a policy-gated verification attempt for a provider claim" }
      },
      "/api/v1/admin/provider-verification-attempts/{id}/complete": {
        post: { tags: ["Claims"], summary: "Complete a provider claim verification attempt with evidence" }
      },
      "/api/v1/admin/provider-outreach": {
        get: { tags: ["Claims"], summary: "List provider claim outreach queue items" },
        post: { tags: ["Claims"], summary: "Create a policy-gated free-claim outreach sequence item" }
      },
      "/api/v1/admin/provider-outreach/{id}/send": {
        post: { tags: ["Claims"], summary: "Mark provider outreach as sent and audit delivery metadata" }
      },
      "/api/v1/events": {
        get: { tags: ["Events"], summary: "List published events" }
      },
      "/api/v1/events/{id}/rsvp": {
        post: { tags: ["Events"], summary: "RSVP to an event" }
      },
      "/api/v1/provider/events/{id}/promotions": {
        get: { tags: ["Events"], summary: "List sponsored promotion records for a provider event" },
        post: { tags: ["Events"], summary: "Create a policy-gated sponsored event promotion" }
      },
      "/api/v1/provider/event-promotions/{id}/activate": {
        post: { tags: ["Events"], summary: "Activate a sponsored event promotion and create labeled ad creative" }
      },
      "/api/v1/provider/events/{id}/analytics": {
        get: { tags: ["Events"], summary: "Get RSVP, promotion, impression, and click analytics for a provider event" }
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
      "/api/v1/admin/extracted-entities": {
        get: { tags: ["Aggregation"], summary: "List extracted provider entities awaiting review" },
        post: { tags: ["Aggregation"], summary: "Stage an extracted provider entity for policy-gated review" }
      },
      "/api/v1/admin/extracted-entities/{id}/approve": {
        post: { tags: ["Aggregation"], summary: "Approve an extracted entity and publish or update provider inventory" }
      },
      "/api/v1/admin/extracted-entities/{id}/reject": {
        post: { tags: ["Aggregation"], summary: "Reject an extracted entity with audit context" }
      },
      "/api/v1/admin/extracted-entities/{id}/duplicate": {
        post: { tags: ["Aggregation"], summary: "Mark an extracted entity as a duplicate of an existing provider" }
      },
      "/api/v1/admin/extracted-entities/{id}/match": {
        post: { tags: ["Aggregation"], summary: "Score and store duplicate match candidates for an extracted entity" }
      },
      "/api/v1/admin/import-batches/{id}/run": {
        post: { tags: ["Aggregation"], summary: "Run a policy-gated import batch and stage extracted provider entities" }
      },
      "/api/v1/system/readiness": {
        get: { tags: ["System"], summary: "Return secret-safe production readiness checks and parked owner items" }
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
