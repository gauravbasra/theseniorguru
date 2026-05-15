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
      "/api/v1/admin/provider-verification-attempts/{id}/send": {
        post: { tags: ["Claims"], summary: "Run policy-gated verification delivery with Mailjet transactional email readiness, dry-run preview, and manual fallback guards" }
      },
      "/api/v1/admin/provider-verification-attempts/expire": {
        post: { tags: ["Claims"], summary: "Expire pending provider claim verification attempts whose deadline has passed" }
      },
      "/api/v1/admin/provider-verification-queue": {
        get: { tags: ["Claims"], summary: "Return owner claim verification queue by readiness, delivery, failure, and approval status" }
      },
      "/api/v1/admin/provider-verification-sla": {
        get: { tags: ["Claims"], summary: "Return claim verification SLA buckets for overdue, due-soon, delivery, failure, and review work" }
      },
      "/api/v1/admin/provider-verification-sla/notify": {
        post: { tags: ["Claims"], summary: "Preview, manual-export, or queue policy-gated claim verification SLA alert delivery" }
      },
      "/api/v1/admin/provider-verification-delivery-readiness": {
        get: { tags: ["Claims"], summary: "Report claim verification delivery adapter readiness by Mailjet email, SMS, phone, and manual channel" }
      },
      "/api/v1/admin/provider-outreach": {
        get: { tags: ["Claims"], summary: "List provider claim outreach queue items" },
        post: { tags: ["Claims"], summary: "Create a policy-gated free-claim outreach sequence item" }
      },
      "/api/v1/admin/provider-outreach/{id}/send": {
        post: { tags: ["Claims"], summary: "Mark provider outreach as sent and audit delivery metadata" }
      },
      "/api/v1/admin/provider-outreach/{id}/requeue": {
        post: { tags: ["Claims"], summary: "Requeue blocked or bounced provider claim outreach with policy audit" }
      },
      "/api/v1/admin/provider-onboarding-readiness": {
        get: { tags: ["Claims"], summary: "Return provider claim, verification, outreach, reputation, and growth onboarding readiness" }
      },
      "/api/v1/admin/leads": {
        get: { tags: ["Leads"], summary: "List family inquiry, free listing, and operator demo intake queue" },
        patch: { tags: ["Leads"], summary: "Update a lead intake status after admin review" }
      },
      "/api/v1/admin/dashboard-metrics": {
        get: { tags: ["System"], summary: "Return chart-ready owner dashboard metrics for launch, inventory, leads, ads, and backend engines" }
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
      "/api/v1/provider/events/{id}/attendance": {
        post: { tags: ["Events"], summary: "Record attended or no-show status for an event RSVP and update event analytics" }
      },
      "/api/v1/admin/event-automation/run": {
        post: { tags: ["Events"], summary: "Queue idempotent event reminders and post-event follow-ups for RSVPs" }
      },
      "/api/v1/app/feed": {
        get: { tags: ["Community"], summary: "Get unified app feed items" }
      },
      "/api/v1/app/session": {
        get: { tags: ["Auth"], summary: "Return signed senior or caregiver app session status" },
        post: { tags: ["Auth"], summary: "Create a signed senior or caregiver app session and bind a consumer profile" }
      },
      "/api/v1/app/devices": {
        get: { tags: ["Community"], summary: "List active push-capable app devices for a signed senior/caregiver session" },
        post: { tags: ["Community"], summary: "Register or refresh a push token for a signed senior/caregiver app session" }
      },
      "/api/v1/articles": {
        get: { tags: ["Newsroom"], summary: "List published senior care guides and newsroom articles" }
      },
      "/api/v1/articles/{slug}": {
        get: { tags: ["Newsroom"], summary: "Get a published senior care guide by slug" }
      },
      "/api/v1/app/saved-providers": {
        get: { tags: ["Community"], summary: "List saved providers for a signed app session or explicit senior/caregiver userKey" },
        post: { tags: ["Community"], summary: "Save a provider for a signed app session with optional notes and tags" }
      },
      "/api/v1/app/care-circles": {
        get: { tags: ["Community"], summary: "List care circles for a signed app session or explicit senior/caregiver userKey" },
        post: { tags: ["Community"], summary: "Create a care circle bound to a signed senior/caregiver app session" }
      },
      "/api/v1/app/care-circles/{id}/members": {
        get: { tags: ["Community"], summary: "List members of a care circle owned by the signed app session" },
        post: { tags: ["Community"], summary: "Invite or add a member to a signed-session care circle" }
      },
      "/api/v1/app/care-circles/{id}/members/{memberId}/invite": {
        post: { tags: ["Community"], summary: "Preview, manual-export, or queue a care-circle family invite delivery job" }
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
        get: { tags: ["Community"], summary: "Get app notification preferences for a signed app session" },
        patch: { tags: ["Community"], summary: "Update app notification preferences for a signed app session" }
      },
      "/api/v1/community/posts": {
        post: { tags: ["Community"], summary: "Create a policy-gated community post" }
      },
      "/api/v1/community/groups": {
        get: { tags: ["Community"], summary: "List local senior-care community groups by city or state" },
        post: { tags: ["Community"], summary: "Create a policy-gated local community group" }
      },
      "/api/v1/community/groups/{id}/members": {
        get: { tags: ["Community"], summary: "List community group members" },
        post: { tags: ["Community"], summary: "Join a local community group with policy and role controls" }
      },
      "/api/v1/community/groups/{id}/invitations": {
        get: { tags: ["Community"], summary: "List invitation delivery records for a community group" },
        post: { tags: ["Community"], summary: "Create a policy-gated community invitation" }
      },
      "/api/v1/admin/community/invitations/{id}/send": {
        post: { tags: ["Community"], summary: "Process a community invitation delivery with audit metadata" }
      },
      "/api/v1/community/topic-subscriptions": {
        get: { tags: ["Community"], summary: "List local community topic subscriptions" },
        post: { tags: ["Community"], summary: "Subscribe a user to a local senior-care topic" }
      },
      "/api/v1/admin/community/digests/run": {
        post: { tags: ["Community"], summary: "Preview, manual-export, or queue local topic community digest delivery jobs" }
      },
      "/api/v1/community/experts": {
        get: { tags: ["Community"], summary: "List verified local senior-care experts" },
        post: { tags: ["Community"], summary: "Submit a local expert profile for verification review" }
      },
      "/api/v1/admin/community/experts/{id}/verify": {
        post: { tags: ["Community"], summary: "Verify, reject, or suspend a local expert profile with policy audit" }
      },
      "/api/v1/community/expert-answers/rank": {
        post: { tags: ["Community"], summary: "Rank verified local experts for a senior-care question using audited routing logic" }
      },
      "/api/v1/community/trust-score": {
        get: { tags: ["Community"], summary: "Calculate local community trust score from verified experts, feed activity, subscriptions, and moderation load" }
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
      "/api/v1/admin/ads/placements": {
        get: { tags: ["Ads"], summary: "List advertising placements" },
        post: { tags: ["Ads"], summary: "Create or update a policy-gated advertising placement" }
      },
      "/api/v1/admin/ads/creatives": {
        post: { tags: ["Ads"], summary: "Create a policy-gated direct-sold ad creative" }
      },
      "/api/v1/admin/ads/reporting": {
        get: { tags: ["Ads"], summary: "Return direct-sold ad placement impressions, clicks, CTR, and optimization next actions" }
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
      "/api/v1/provider-portal/providers/{id}/profile-updates": {
        get: { tags: ["Providers"], summary: "Return provider-facing profile edit approval status and review history" }
      },
      "/api/v1/admin/provider-profile-updates": {
        get: { tags: ["Providers"], summary: "List claimed-provider profile edit audit queue for admin review" }
      },
      "/api/v1/admin/provider-profile-updates/{id}/decide": {
        post: { tags: ["Providers"], summary: "Approve/apply or reject a claimed-provider profile edit audit" }
      },
      "/api/v1/provider/entitlements/check": {
        post: { tags: ["Billing"], summary: "Check whether a provider has access to a paid or free feature" }
      },
      "/api/v1/provider/campaigns": {
        get: { tags: ["Campaigns"], summary: "List provider campaigns" },
        post: { tags: ["Campaigns"], summary: "Create a provider marketing campaign" }
      },
      "/api/v1/provider/campaigns/{id}/metrics": {
        post: { tags: ["Campaigns"], summary: "Record a campaign impression, click, lead, or conversion event" }
      },
      "/api/v1/provider/campaigns/metrics": {
        get: { tags: ["Campaigns"], summary: "Return provider campaign, asset, and metric rollups" }
      },
      "/api/v1/provider/campaigns/optimization-recommendations": {
        get: { tags: ["Campaigns"], summary: "Return provider-facing campaign optimization recommendations from recorded metrics" }
      },
      "/api/v1/provider/review-request-campaigns": {
        get: { tags: ["Reviews"], summary: "List provider review request campaigns" },
        post: { tags: ["Reviews"], summary: "Create a consent-gated review request campaign" }
      },
      "/api/v1/provider/review-request-campaigns/{id}/send": {
        post: { tags: ["Reviews"], summary: "Run the consent-gated review request send worker for a campaign" }
      },
      "/api/v1/provider/reputation-readiness": {
        get: { tags: ["Reviews"], summary: "Return provider reputation workflow readiness, review health, campaigns, and blockers" }
      },
      "/api/v1/provider/review-requests": {
        get: { tags: ["Reviews"], summary: "List review request recipients and statuses" }
      },
      "/api/v1/admin/reviews/moderation": {
        get: { tags: ["Reviews"], summary: "List reviews awaiting moderation" }
      },
      "/api/v1/admin/reviews/{id}/moderate": {
        post: { tags: ["Reviews"], summary: "Moderate a review with policy and audit context" }
      },
      "/api/v1/admin/reviews/{id}/sentiment": {
        post: { tags: ["Reviews"], summary: "Score review sentiment for reputation analytics" }
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
      "/api/v1/admin/newsroom/sources": {
        get: { tags: ["Newsroom"], summary: "List approved and pending editorial content sources" },
        post: { tags: ["Newsroom"], summary: "Create a policy-gated editorial content source" }
      },
      "/api/v1/admin/newsroom/rss/import": {
        post: { tags: ["Newsroom"], summary: "Import RSS feed items into the policy-gated newsroom inbox" }
      },
      "/api/v1/admin/newsroom/rss/run": {
        post: { tags: ["Newsroom"], summary: "Run scheduled RSS intake across approved editorial sources" }
      },
      "/api/cron/newsroom": {
        get: { tags: ["Newsroom"], summary: "Run protected scheduled newsroom RSS intake and record worker observability" }
      },
      "/api/cron/source-manifests": {
        get: { tags: ["Aggregation"], summary: "Run protected scheduled source manifest signed-object fetch worker in preview or live mode" }
      },
      "/api/cron/import-escalation-retries": {
        get: { tags: ["Aggregation"], summary: "Run protected import escalation retry scheduling and retry delivery in preview or live mode" }
      },
      "/api/cron/webhooks": {
        get: { tags: ["System"], summary: "Run protected webhook retry scheduler in preview or live mode" }
      },
      "/api/v1/admin/newsroom/articles": {
        post: { tags: ["Newsroom"], summary: "Create a policy-gated AI-assisted article draft" }
      },
      "/api/v1/admin/newsroom/articles/{id}/approve": {
        post: { tags: ["Newsroom"], summary: "Approve an article for publishing after editorial and policy review" }
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
      "/api/v1/admin/newsroom/newsletters": {
        get: { tags: ["Newsroom"], summary: "List newsletter editions assembled by the newsroom workflow" },
        post: { tags: ["Newsroom"], summary: "Create a policy-gated newsletter edition from approved articles" }
      },
      "/api/v1/admin/newsroom/newsletters/{id}/approve": {
        post: { tags: ["Newsroom"], summary: "Approve a newsletter edition after editorial and policy review" }
      },
      "/api/v1/admin/newsroom/newsletters/{id}/schedule": {
        post: { tags: ["Newsroom"], summary: "Schedule an approved newsletter edition for distribution" }
      },
      "/api/v1/admin/newsroom/newsletters/{id}/send": {
        post: { tags: ["Newsroom"], summary: "Run policy-gated newsletter delivery with provider readiness, dry-run, and delivery-attempt audit" }
      },
      "/api/v1/admin/newsroom/newsletters/{id}/delivery-preview": {
        post: { tags: ["Newsroom"], summary: "Preview provider-specific newsletter delivery payload, consent requirements, and credential blockers" }
      },
      "/api/v1/admin/newsroom/performance": {
        get: { tags: ["Newsroom"], summary: "Return article, newsletter, and derivative performance metric rollups" },
        post: { tags: ["Newsroom"], summary: "Record a policy-gated content view, click, share, save, open, or lead metric" }
      },
      "/api/v1/admin/newsroom/performance/export": {
        get: { tags: ["Newsroom"], summary: "Export daily or weekly editorial performance trend rows as JSON or CSV" }
      },
      "/api/v1/newsletters/{id}": {
        get: { tags: ["Newsroom"], summary: "Get an approved, scheduled, or sent newsletter edition" }
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
      "/api/v1/admin/extracted-entities/{id}/merge-readiness": {
        post: { tags: ["Aggregation"], summary: "Compare an extracted entity with a matched provider and report safe merge blockers" }
      },
      "/api/v1/admin/extracted-entities/{id}/assignment": {
        post: { tags: ["Aggregation"], summary: "Assign an extracted entity review owner and SLA due date" }
      },
      "/api/v1/admin/extracted-entities/quality-audit": {
        post: { tags: ["Aggregation"], summary: "Run launch-quality checks and flag staged provider records" }
      },
      "/api/v1/admin/extracted-entities/review-queue": {
        get: { tags: ["Aggregation"], summary: "Review confidence, duplicate, legal, and image-rights routing for staged entities" }
      },
      "/api/v1/admin/extracted-entities/escalations": {
        get: { tags: ["Aggregation"], summary: "Summarize overdue, due-soon, unassigned, and blocked extracted-entity reviews" }
      },
      "/api/v1/admin/extracted-entities/escalations/delivery-readiness": {
        get: { tags: ["Aggregation"], summary: "Report manual export and HTTPS internal queue readiness for extracted entity escalation delivery" }
      },
      "/api/v1/admin/extracted-entities/escalations/notify": {
        post: { tags: ["Aggregation"], summary: "Preview, manually record, or dispatch import review escalations to the configured HTTPS internal queue" }
      },
      "/api/v1/admin/extracted-entities/escalations/delivery-callback": {
        post: { tags: ["Aggregation"], summary: "Record provider delivery callbacks for import review escalation notifications with audit evidence" }
      },
      "/api/v1/admin/extracted-entities/escalations/retry-scheduler": {
        post: { tags: ["Aggregation"], summary: "Preview or record retry scheduling for failed import escalation delivery callbacks" }
      },
      "/api/v1/admin/extracted-entities/escalations/retry-delivery": {
        post: { tags: ["Aggregation"], summary: "Preview or execute scheduled import escalation retry delivery batches" }
      },
      "/api/v1/admin/data-sources": {
        get: { tags: ["Aggregation"], summary: "List source registry entries with approval, robots, and terms status" },
        post: { tags: ["Aggregation"], summary: "Register a source before import or crawling" }
      },
      "/api/v1/admin/data-sources/approval-queue": {
        get: { tags: ["Aggregation"], summary: "Summarize source approval queues, missing review fields, risk levels, and import readiness" }
      },
      "/api/v1/admin/data-sources/{id}/approve": {
        post: { tags: ["Aggregation"], summary: "Approve a registered data source with robots and terms evidence" }
      },
      "/api/v1/admin/data-sources/{id}/block": {
        post: { tags: ["Aggregation"], summary: "Block a registered data source from import and crawling" }
      },
      "/api/v1/admin/import-batches/{id}/run": {
        post: { tags: ["Aggregation"], summary: "Run a policy-gated import batch and stage extracted provider entities" }
      },
      "/api/v1/admin/import-batches/{id}/requeue": {
        post: { tags: ["Aggregation"], summary: "Requeue a failed, blocked, or partial import batch for another run" }
      },
      "/api/v1/admin/import-launch-plan": {
        get: { tags: ["Aggregation"], summary: "Calculate launch import waves toward the 5,000-listing target" },
        post: { tags: ["Aggregation"], summary: "Optionally create queued launch import batches from the calculated plan" }
      },
      "/api/v1/admin/import-launch-sources/seed": {
        post: { tags: ["Aggregation"], summary: "Idempotently seed approved launch import sources and optional starter batches" }
      },
      "/api/v1/admin/import-adapters": {
        get: { tags: ["Aggregation"], summary: "Report CMS, state, manual, provider website, RSS, and vendor import adapter readiness" }
      },
      "/api/v1/admin/source-adapter-imports": {
        get: { tags: ["Aggregation"], summary: "Report CMS, state license, and owner-controlled source adapter run readiness" },
        post: { tags: ["Aggregation"], summary: "Run approved CMS, state license, or owner-controlled source payload records through the import worker" }
      },
      "/api/v1/admin/source-adapter-imports/worker": {
        post: { tags: ["Aggregation"], summary: "Preview or execute scheduled CMS, state, and owner-controlled source adapter imports with supplied payload records" }
      },
      "/api/v1/admin/source-adapter-manifests": {
        get: { tags: ["Aggregation"], summary: "Report CMS, state, and owner-controlled source file manifest checksum and mapping readiness" },
        post: { tags: ["Aggregation"], summary: "Register source adapter export file manifest metadata without storing file contents" }
      },
      "/api/v1/admin/source-adapter-manifests/load": {
        post: { tags: ["Aggregation"], summary: "Load supplied source payload records through a verified file manifest and governed import worker" }
      },
      "/api/v1/admin/source-adapter-manifests/fetch": {
        post: { tags: ["Aggregation"], summary: "Fetch a verified HTTPS source manifest object, checksum it, parse JSON records, and run the governed import worker" }
      },
      "/api/v1/admin/source-adapter-manifests/fetch/worker": {
        post: { tags: ["Aggregation"], summary: "Preview or run scheduled signed object fetches for fetch-ready source manifests" }
      },
      "/api/v1/admin/source-adapter-manifests/storage-readiness": {
        get: { tags: ["Aggregation"], summary: "Report source manifest object-storage scheme readiness and owner credential blockers" }
      },
      "/api/v1/admin/vendor-feed-connections": {
        get: { tags: ["Aggregation"], summary: "Report vendor feed contract, credential reference, and field mapping readiness" },
        post: { tags: ["Aggregation"], summary: "Record safe vendor feed credential metadata without storing vendor secrets" }
      },
      "/api/v1/admin/vendor-feed-imports": {
        post: { tags: ["Aggregation"], summary: "Run ready vendor feed records through the governed import worker" }
      },
      "/api/v1/admin/vendor-feed-imports/worker": {
        post: { tags: ["Aggregation"], summary: "Preview or execute scheduled vendor feed imports for ready feeds with supplied payload records" }
      },
      "/api/v1/admin/import-launch-execution": {
        get: { tags: ["Aggregation"], summary: "Return runnable, blocked, and skipped launch import batch execution status" },
        post: { tags: ["Aggregation"], summary: "Execute runnable launch import batches through source-specific adapters" }
      },
      "/api/v1/admin/current-site-inventory/import": {
        post: { tags: ["Aggregation"], summary: "Crawl current TheSeniorGuru listing pages and stage real inventory records" }
      },
      "/api/v1/admin/public-source-acquisition/sample-run": {
        post: { tags: ["Aggregation"], summary: "Run a seeded public-source acquisition batch with provenance, image, and quality reporting" }
      },
      "/api/v1/admin/public-source-acquisition/current-site-preview": {
        get: { tags: ["Aggregation"], summary: "Read real current-site listing preview records for admin inventory review" },
        post: { tags: ["Aggregation"], summary: "Preview/export parsed real current-site listing records before staging" }
      },
      "/api/v1/admin/public-source-acquisition/current-site-run": {
        post: { tags: ["Aggregation"], summary: "Run real current TheSeniorGuru.com listing acquisition with robots, provenance, image, and quality reporting" }
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
      "/api/v1/admin/provider-website-parser": {
        get: { tags: ["Aggregation"], summary: "Report provider website parser readiness by source, crawl job, and staged page" },
        post: { tags: ["Aggregation"], summary: "Parse completed provider website crawl pages into extracted entity candidates" }
      },
      "/api/v1/admin/provider-website-parser/rules": {
        get: { tags: ["Aggregation"], summary: "Report provider website parser rule coverage, source overrides, stageability, and tuning blockers" },
        post: { tags: ["Aggregation"], summary: "Create or update governed source-specific provider website parser rule overrides" }
      },
      "/api/v1/admin/provider-website-parser/rules/audit": {
        get: { tags: ["Aggregation"], summary: "Summarize provider website parser override, rollback, replacement, impact comparison, and unaudited override gaps" }
      },
      "/api/v1/admin/provider-website-parser/rules/impact": {
        post: { tags: ["Aggregation"], summary: "Compare default, active, and proposed provider website parser rule impact before override changes" }
      },
      "/api/v1/admin/provider-website-parser/rules/impact/attach": {
        post: { tags: ["Aggregation"], summary: "Attach retained parser impact comparison evidence to an active parser override decision trail" }
      },
      "/api/v1/admin/provider-website-parser/rules/impact/export": {
        get: { tags: ["Aggregation"], summary: "Export retained provider website parser impact comparison evidence as JSON or CSV" }
      },
      "/api/v1/admin/provider-website-parser/rules/rollback": {
        post: { tags: ["Aggregation"], summary: "Preview or deactivate a governed provider website parser rule override with rollback audit evidence" }
      },
      "/api/v1/admin/provider-website-parser/rules/replace": {
        post: { tags: ["Aggregation"], summary: "Preview or replace an active provider website parser rule override with previous/new audit evidence" }
      },
      "/api/v1/admin/data-quality-flags": {
        get: { tags: ["Aggregation"], summary: "List unresolved data quality flags for import/crawl review" }
      },
      "/api/v1/admin/api-clients": {
        get: { tags: ["System"], summary: "List approved Open API clients" },
        post: { tags: ["System"], summary: "Create a tenant-scoped Open API client" }
      },
      "/api/v1/admin/api-clients/{id}/keys": {
        get: { tags: ["System"], summary: "List API keys for an Open API client without exposing secrets" },
        post: { tags: ["System"], summary: "Mint a signed API key and store only its hash" }
      },
      "/api/v1/admin/api-clients/{id}/keys/{keyId}/revoke": {
        post: { tags: ["System"], summary: "Revoke an Open API key and write an audit event" }
      },
      "/api/v1/admin/api-clients/{id}/production-promotion": {
        post: { tags: ["System"], summary: "Review and owner-approve partner API client promotion from sandbox to production mode" }
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
      "/api/v1/admin/webhook-deliveries/retry": {
        post: { tags: ["System"], summary: "Requeue failed or blocked webhook deliveries for another signed attempt" }
      },
      "/api/v1/admin/webhook-deliveries/replay": {
        post: { tags: ["System"], summary: "Replay failed, blocked, or delivered webhook deliveries as fresh queued records with audit evidence" }
      },
      "/api/v1/admin/webhook-deliveries/replay/export": {
        get: { tags: ["System"], summary: "Export filtered webhook replay source-delivery evidence as JSON or CSV for partner operations review" }
      },
      "/api/v1/admin/webhook-deliveries/scheduler": {
        post: { tags: ["System"], summary: "Preview or run the scheduled webhook retry worker with failed and blocked candidate counts" }
      },
      "/api/v1/admin/api-audit-events": {
        get: { tags: ["System"], summary: "List Open API audit events" }
      },
      "/api/v1/admin/api-usage-analytics": {
        get: { tags: ["System"], summary: "Summarize or CSV-export partner API usage, blocked calls, rate limits, keys, webhooks, and retention policy" }
      },
      "/api/v1/admin/scheduled-worker-runs": {
        get: { tags: ["System"], summary: "List scheduled backend worker run history with status, duration, and summaries" }
      },
      "/api/v1/admin/scheduled-worker-health": {
        get: { tags: ["System"], summary: "Summarize expected cron worker health, stale runs, failures, and launch blockers" }
      },
      "/api/v1/admin/scheduled-worker-alerts": {
        post: { tags: ["System"], summary: "Preview or record scheduled-worker alert delivery with manual export and live-provider blockers" }
      },
      "/api/v1/admin/audit-events": {
        get: { tags: ["Policy"], summary: "List immutable operational audit events for policy, claims, imports, and publishing workflows" }
      },
      "/api/v1/admin/audit-events/export": {
        get: { tags: ["Policy"], summary: "Export immutable operational audit events as JSON or CSV with retention candidate totals" }
      },
      "/api/v1/admin/audit-events/retention": {
        get: { tags: ["Policy"], summary: "Preview audit event retention candidates without destructive purge execution" },
        post: { tags: ["Policy"], summary: "Preview or blocked-live audit retention controls with owner approval guardrails" }
      },
      "/api/v1/partner/providers": {
        get: { tags: ["Providers"], summary: "Partner provider directory API requiring providers:read scope" }
      },
      "/api/v1/partner/events": {
        get: { tags: ["Events"], summary: "Partner events API requiring events:read scope" }
      },
      "/api/v1/partner/usage": {
        get: { tags: ["System"], summary: "Partner-scoped API usage summary, retention policy, or CSV export requiring usage:read scope" }
      },
      "/api/v1/partner/onboarding-checklist": {
        get: { tags: ["System"], summary: "Return the partner sandbox onboarding checklist with scopes, evidence, and production promotion blockers" }
      },
      "/api/v1/partner/changelog": {
        get: { tags: ["System"], summary: "Return partner API version changelog, deprecation policy, migration notes, and planned release signals" }
      },
      "/api/v1/partner/sdk-package-plan": {
        get: { tags: ["System"], summary: "Return webhook SDK package publishing plan, security controls, release gates, and owner blockers" }
      },
      "/api/v1/partner/sandbox-evidence": {
        get: { tags: ["System"], summary: "Return JSON or CSV partner sandbox evidence bundle for promotion review" }
      },
      "/api/v1/partner/response-envelope": {
        get: { tags: ["System"], summary: "Return partner response envelope version, headers, paths, and migration rules" }
      },
      "/api/v1/partner/response-pagination": {
        get: { tags: ["System"], summary: "Return partner response pagination parameters, meta shape, and traversal rules" }
      },
      "/api/v1/partner/developer-docs": {
        get: { tags: ["System"], summary: "Return partner developer documentation, SDK examples, OpenAPI endpoints, and webhook signing contracts" }
      },
      "/api/v1/partner/webhooks/verify": {
        post: { tags: ["System"], summary: "Verify a webhook payload signature for an owned subscription requiring webhooks:write scope" }
      },
      "/api/v1/partner/webhooks/signing-guide": {
        get: { tags: ["System"], summary: "Return webhook signing headers, HMAC verification steps, event list, and deterministic sample payload" }
      },
      "/api/v1/system/readiness": {
        get: { tags: ["System"], summary: "Return secret-safe production readiness checks and parked owner items" }
      },
      "/api/v1/system/persistence": {
        get: { tags: ["System"], summary: "Return whether backend writes are using Supabase persistence or fallback memory" }
      },
      "/api/v1/system/deployment": {
        get: { tags: ["System"], summary: "Return production deployment target, canonical URL, persistence mode, and owner DNS actions" }
      },
      "/api/v1/system/production-cutover": {
        get: { tags: ["System"], summary: "Return production DNS cutover readiness gates, blockers, owner actions, and rollback evidence requirements" }
      },
      "/api/v1/system/dns-cutover-approval": {
        get: { tags: ["System"], summary: "Return latest owner DNS cutover approval or deferral evidence" },
        post: { tags: ["System"], summary: "Record an audited owner DNS cutover approval, deferral, or readiness review" }
      },
      "/api/v1/system/dns-cutover-smoke-checklist": {
        get: { tags: ["System"], summary: "Return DNS cutover change-window smoke checklist phases, routes, blockers, and rollback steps" },
        post: { tags: ["System"], summary: "Archive DNS cutover smoke checklist evidence to operational audit events" }
      },
      "/api/v1/system/public-domain-smoke": {
        get: { tags: ["System"], summary: "Run public-domain smoke checks against theseniorguru.com or a deployment target" },
        post: { tags: ["System"], summary: "Archive public-domain smoke evidence for DNS cutover completion review" }
      },
      "/api/v1/system/credential-installation": {
        get: { tags: ["System"], summary: "Return production credential installation runbook, blockers, validation checks, and CSV evidence" },
        post: { tags: ["System"], summary: "Record a no-secret credential installation review with audit evidence" }
      },
      "/api/v1/system/credential-smoke-evidence": {
        get: { tags: ["System"], summary: "Export credential smoke evidence rows, validation status, blockers, and CSV evidence" },
        post: { tags: ["System"], summary: "Archive credential smoke evidence to operational audit events" }
      },
      "/api/v1/system/credential-evidence-retention": {
        get: { tags: ["System"], summary: "Return credential smoke evidence archive retention dashboard or CSV export" },
        post: { tags: ["System"], summary: "Record credential evidence retention review with live purge blocked until owner approval" }
      },
      "/api/v1/system/post-cutover-monitor": {
        get: { tags: ["System"], summary: "Return deployment, DNS, persistence, credential, rollback, and link-health monitor probes" },
        post: { tags: ["System"], summary: "Record an audited post-cutover synthetic monitor run" }
      },
      "/api/v1/system/post-cutover-monitor-alerts": {
        get: { tags: ["System"], summary: "Preview post-cutover monitor alert payloads and delivery readiness" },
        post: { tags: ["System"], summary: "Send or archive post-cutover monitor alert evidence through approved delivery providers" }
      },
      "/api/v1/system/rollback-evidence": {
        get: { tags: ["System"], summary: "Export production rollback evidence, deployment metadata, launch blockers, and recovery steps as JSON or CSV" }
      },
      "/api/v1/system/launch-checklist": {
        get: { tags: ["System"], summary: "Return launch go/no-go checklist across config, schema, links, aggregation, ads, newsroom, and onboarding" }
      },
      "/api/v1/system/supabase-schema": {
        get: { tags: ["System"], summary: "Return Supabase migration manifest and live table readiness checks" }
      },
      "/api/v1/system/supabase-migration-plan": {
        get: { tags: ["System"], summary: "Return deploy-safe Supabase migration order, file coverage, capability mapping, and owner blockers" }
      },
      "/api/v1/admin/supabase-migration-bundle": {
        get: { tags: ["System"], summary: "Return ordered, checksummed Supabase migration bundle metadata and optional SQL for production activation" }
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
      },
      "/api/v1/admin/policy-queue": {
        get: { tags: ["Policy"], summary: "List policy checks requiring review, disclosure verification, or blocked-action resolution" }
      },
      "/api/v1/admin/policy-review-assignments": {
        get: { tags: ["Policy"], summary: "List policy reviewer assignments and assignable legal, expert, or policy-review checks" },
        post: { tags: ["Policy"], summary: "Preview or record reviewer ownership for legal, expert, or policy-review checks" }
      },
      "/api/v1/admin/policy-overrides": {
        get: { tags: ["Policy"], summary: "List policy override approval requests" },
        post: { tags: ["Policy"], summary: "Request a governed override for an overridable policy check" }
      },
      "/api/v1/admin/policy-overrides/expire": {
        post: { tags: ["Policy"], summary: "Expire requested or approved policy overrides whose expiry time has passed" }
      },
      "/api/v1/admin/policy-overrides/{id}/decide": {
        post: { tags: ["Policy"], summary: "Approve or reject a requested policy override with audit evidence" }
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
