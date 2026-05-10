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
      { name: "Billing" },
      { name: "Campaigns" },
      { name: "Reviews" },
      { name: "Newsroom" },
      { name: "Aggregation" },
      { name: "System" },
      { name: "Workbench" },
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
      "/api/v1/providers/{id}/contact": {
        post: { tags: ["Providers"], summary: "Submit a consented provider contact intent" }
      },
      "/api/v1/categories": {
        get: { tags: ["Providers"], summary: "List provider categories with inventory counts and state coverage" }
      },
      "/api/v1/locations/search": {
        get: { tags: ["Providers"], summary: "Search launch locations by query, state, and category" }
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
      "/api/v1/app/saved-providers": {
        get: { tags: ["Community"], summary: "List saved providers for a senior or caregiver app user" },
        post: { tags: ["Community"], summary: "Save a provider with optional notes and tags" }
      },
      "/api/v1/app/care-circles": {
        get: { tags: ["Community"], summary: "List care circles for an app user" },
        post: { tags: ["Community"], summary: "Create a care circle for collaborative senior-care planning" }
      },
      "/api/v1/app/care-circles/{id}/members": {
        get: { tags: ["Community"], summary: "List members of a care circle" },
        post: { tags: ["Community"], summary: "Invite or add a member to a care circle" }
      },
      "/api/v1/app/comparison-lists": {
        get: { tags: ["Community"], summary: "List provider comparison lists for a senior or caregiver app user" },
        post: { tags: ["Community"], summary: "Create a provider comparison list with optional starting providers" }
      },
      "/api/v1/app/comparison-lists/{id}/providers": {
        post: { tags: ["Community"], summary: "Add a provider to a comparison list" }
      },
      "/api/v1/app/care-notes": {
        get: { tags: ["Community"], summary: "List private or care-circle notes for an app user" },
        post: { tags: ["Community"], summary: "Create a policy-gated care planning note" }
      },
      "/api/v1/app/tour-plans": {
        get: { tags: ["Community"], summary: "List provider tour plans for an app user" },
        post: { tags: ["Community"], summary: "Request or plan a provider tour" }
      },
      "/api/v1/me/notification-preferences": {
        get: { tags: ["Community"], summary: "Get app notification preferences for a user" },
        patch: { tags: ["Community"], summary: "Update app notification preferences for a user" }
      },
      "/api/v1/community/posts": {
        post: { tags: ["Community"], summary: "Create a policy-gated community post" }
      },
      "/api/v1/community/posts/{id}/comments": {
        get: { tags: ["Community"], summary: "List published comments for a community post" },
        post: { tags: ["Community"], summary: "Create a policy-gated community comment" }
      },
      "/api/v1/community/reports": {
        post: { tags: ["Community"], summary: "Report community content for moderation" }
      },
      "/api/v1/admin/community/posts/{id}/moderate": {
        post: { tags: ["Community"], summary: "Moderate a community post with audit context" }
      },
      "/api/v1/admin/community/comments/{id}/moderate": {
        post: { tags: ["Community"], summary: "Moderate a community comment with audit context" }
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
      "/api/v1/provider/growth-plans": {
        get: { tags: ["Billing"], summary: "List active provider growth plans and feature bundles" }
      },
      "/api/v1/provider/growth-subscriptions": {
        get: { tags: ["Billing"], summary: "List provider growth subscriptions and active entitlements" },
        post: { tags: ["Billing"], summary: "Create a contract-first provider growth subscription" }
      },
      "/api/v1/provider/growth-subscriptions/{id}/activate": {
        post: { tags: ["Billing"], summary: "Activate a provider growth subscription and feature entitlements" }
      },
      "/api/v1/provider-portal/providers/{id}": {
        patch: { tags: ["Providers"], summary: "Submit provider profile changes into the policy/audit review workflow" }
      },
      "/api/v1/provider/entitlements/check": {
        post: { tags: ["Billing"], summary: "Check whether a provider has access to a paid or free feature" }
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
      "/api/v1/admin/current-site-inventory/import": {
        post: { tags: ["Aggregation"], summary: "Run current Senior Guru inventory import into the staging pipeline" }
      },
      "/api/v1/system/readiness": {
        get: { tags: ["System"], summary: "Return secret-safe production readiness checks and parked owner items" }
      },
      "/api/v1/system/product-map": {
        get: { tags: ["System"], summary: "Return FRD-aligned product pillars, backend routes, launch targets, and blockers" }
      },
      "/api/v1/system/link-health": {
        get: { tags: ["System"], summary: "Validate internal route contracts and block placeholder links" }
      },
      "/api/v1/workbench/demo-run": {
        post: { tags: ["Workbench"], summary: "Run an executable founder workflow across platform services" }
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
