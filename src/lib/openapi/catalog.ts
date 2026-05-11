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
      { name: "Leads" },
      { name: "Policy" },
      { name: "Auth" }
    ],
    paths: {
      "/api/v1/auth/login": {
        post: { tags: ["Auth"], summary: "Create an owner admin session with a signed HttpOnly cookie" }
      },
      "/api/v1/auth/logout": {
        post: { tags: ["Auth"], summary: "Clear the owner admin session" }
      },
      "/api/v1/auth/session": {
        get: { tags: ["Auth"], summary: "Return current owner admin session status" }
      },
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
      "/api/v1/inquiries": {
        post: { tags: ["Leads"], summary: "Submit a consented family senior-care discovery inquiry" }
      },
      "/api/v1/operator/free-listing-requests": {
        post: { tags: ["Leads"], summary: "Submit a free community listing onboarding request" }
      },
      "/api/v1/operator/demo-requests": {
        post: { tags: ["Leads"], summary: "Submit an operator demo request for occupancy growth tools" }
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
      "/api/v1/admin/provider-onboarding-readiness": {
        get: { tags: ["Claims"], summary: "Return provider claim, verification, outreach, reputation, and growth onboarding readiness" }
      },
      "/api/v1/admin/leads": {
        get: { tags: ["Leads"], summary: "List family inquiry, free listing, and operator demo intake queue" },
        patch: { tags: ["Leads"], summary: "Update a lead intake status after admin review" }
      },
      "/api/v1/provider-portal/claims/{id}/status": {
        get: { tags: ["Claims"], summary: "Return provider-facing claim status, verification checklist, and next action" }
      },
      "/api/v1/provider-portal/claims/{id}/verification-evidence": {
        post: { tags: ["Claims"], summary: "Submit provider-facing claim verification evidence and move claim to admin review" }
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
      "/api/v1/articles": {
        get: { tags: ["Newsroom"], summary: "List published senior care guides and newsroom articles" }
      },
      "/api/v1/articles/{slug}": {
        get: { tags: ["Newsroom"], summary: "Get a published senior care guide by slug" }
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
      "/api/v1/admin/ad-readiness": {
        get: { tags: ["Ads"], summary: "Return direct-sold and Google backfill advertising readiness" }
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
      "/api/v1/provider/review-request-campaigns": {
        get: { tags: ["Reviews"], summary: "List provider review request campaigns" },
        post: { tags: ["Reviews"], summary: "Create a consent-gated review request campaign" }
      },
      "/api/v1/provider/reputation-readiness": {
        get: { tags: ["Reviews"], summary: "Return provider reputation workflow readiness, review health, campaigns, and blockers" }
      },
      "/api/v1/provider/review-requests": {
        get: { tags: ["Reviews"], summary: "List review request recipients and statuses" }
      },
      "/api/v1/provider-portal/reviews/{id}/responses/publish": {
        post: { tags: ["Reviews"], summary: "Publish a policy-gated provider response to a review" }
      },
      "/api/v1/providers/{id}/reviews": {
        get: { tags: ["Reviews"], summary: "List published reviews" },
        post: { tags: ["Reviews"], summary: "Submit a first-party review for moderation" }
      },
      "/api/v1/admin/newsroom/inbox": {
        get: { tags: ["Newsroom"], summary: "List newsroom source items" },
        post: { tags: ["Newsroom"], summary: "Create a newsroom source item" }
      },
      "/api/v1/admin/newsroom/articles": {
        post: { tags: ["Newsroom"], summary: "Create a policy-gated AI-assisted article draft" }
      },
      "/api/v1/admin/newsroom/articles/{id}/publish": {
        post: { tags: ["Newsroom"], summary: "Publish an approved article with policy checks" }
      },
      "/api/v1/admin/newsroom/articles/{id}/generate-social": {
        post: { tags: ["Newsroom"], summary: "Generate social and newsletter derivatives for an article" }
      },
      "/api/v1/admin/newsroom/articles/{id}/generate-podcast-brief": {
        post: { tags: ["Newsroom"], summary: "Generate a podcast/interview brief for an article" }
      },
      "/api/v1/admin/newsroom/readiness": {
        get: { tags: ["Newsroom"], summary: "Return newsroom source, article, derivative, and policy readiness" }
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
      "/api/v1/admin/import-launch-plan": {
        get: { tags: ["Aggregation"], summary: "Calculate launch import waves toward the 5,000-listing target" },
        post: { tags: ["Aggregation"], summary: "Optionally create queued launch import batches from the calculated plan" }
      },
      "/api/v1/admin/current-site-inventory/import": {
        post: { tags: ["Aggregation"], summary: "Run current Senior Guru inventory import into the staging pipeline" }
      },
      "/api/v1/admin/aggregation-readiness": {
        get: { tags: ["Aggregation"], summary: "Return launch import, crawler, source, and quality readiness summary" }
      },
      "/api/v1/admin/crawl-jobs": {
        get: { tags: ["Aggregation"], summary: "List crawler jobs for approved data sources" },
        post: { tags: ["Aggregation"], summary: "Create a policy-gated crawler job for an approved data source" }
      },
      "/api/v1/admin/crawl-jobs/{id}/run": {
        post: { tags: ["Aggregation"], summary: "Run a crawler job with dry-run support and crawl page staging" }
      },
      "/api/v1/admin/data-quality-flags": {
        get: { tags: ["Aggregation"], summary: "List unresolved data quality flags for import/crawl review" }
      },
      "/api/v1/admin/api-clients": {
        get: { tags: ["System"], summary: "List approved Open API clients" },
        post: { tags: ["System"], summary: "Create a tenant-scoped Open API client" }
      },
      "/api/v1/admin/api-clients/{id}/keys": {
        post: { tags: ["System"], summary: "Mint a signed API key and store only its hash" }
      },
      "/api/v1/admin/webhook-subscriptions": {
        get: { tags: ["System"], summary: "List Open API webhook subscriptions" },
        post: { tags: ["System"], summary: "Create a signed HTTPS webhook subscription" }
      },
      "/api/v1/admin/webhook-deliveries": {
        get: { tags: ["System"], summary: "List webhook delivery records by status" },
        post: { tags: ["System"], summary: "Queue webhook delivery records for matching active subscriptions" }
      },
      "/api/v1/admin/webhook-deliveries/run": {
        post: { tags: ["System"], summary: "Process queued webhook deliveries with signed payloads and attempt records" }
      },
      "/api/v1/admin/api-audit-events": {
        get: { tags: ["System"], summary: "List Open API audit events" }
      },
      "/api/v1/partner/providers": {
        get: { tags: ["Providers"], summary: "Partner provider directory API requiring providers:read scope" }
      },
      "/api/v1/partner/events": {
        get: { tags: ["Events"], summary: "Partner events API requiring events:read scope" }
      },
      "/api/v1/system/readiness": {
        get: { tags: ["System"], summary: "Return secret-safe production readiness checks and parked owner items" }
      },
      "/api/v1/system/launch-checklist": {
        get: { tags: ["System"], summary: "Return launch go/no-go checklist across config, schema, links, aggregation, ads, newsroom, and onboarding" }
      },
      "/api/v1/system/supabase-schema": {
        get: { tags: ["System"], summary: "Return Supabase migration manifest and live table readiness checks" }
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
