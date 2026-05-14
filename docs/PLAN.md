# The Senior Guru Build Plan

## Phase 0: Foundation

Status: in progress

Deliverables:

- Clean Next.js project skeleton. Completed.
- Repo-level execution guardrails. Completed.
- Repo-local FRD and research docs. Completed.
- Provider inventory schema. Completed.
- Source/provenance schema. Completed.
- Policy gate schema. Completed.
- Public provider search/detail API. Completed.
- Source registry API. Completed.
- Policy check API. Completed.
- Aggregation queue schema. Completed.
- Import batch API. Completed.
- Provider claim API. Completed.
- Claim/verification schema. Completed.
- Verification attempt create/list/complete APIs. Completed.
- Provider-facing claim status and verification checklist API. Completed.
- Automatic initial verification attempt after claim submission. Completed.
- Provider-facing claim evidence submission API and console action. Completed.
- License/document review decision API with auditable review persistence and admin console action. Completed.
- Business email/domain and business phone verification code issue/confirm APIs with hashed code storage. Completed.
- Provider profile completion assistant API and dashboard action. Completed.
- Provider onboarding readiness API across claim, verification, outreach, reputation, and growth. Completed.
- Provider visibility report API and dashboard panel for profile completion, discovery, reputation, growth readiness, missing fields, entitlements, and next-best-actions. Completed.
- Admin claim approve/reject workflow. Completed.
- Admin claimed-provider profile edit review queue and decision APIs with policy/audit controls. Completed.
- Admin provider verification queue API for ready, pending-delivery, failed/expired, and not-started claim work. Completed.
- Admin provider verification SLA API for overdue, due-soon, delivery, failed/expired, and review-ready claim work. Completed.
- Admin provider verification SLA alert preview/record API with policy gate, manual export path, and blocked live queue adapter. Completed.
- Admin provider verification delivery readiness API for manual, email, SMS, and phone adapter status. Completed.
- Event marketplace schema. Completed.
- Event publish and RSVP APIs. Completed.
- Sponsored event promotion APIs. Completed.
- Event promotion to ad creative activation workflow. Completed.
- Event analytics API. Completed.
- Admin events/community operations console for event publishing, RSVPs, promotions, analytics, groups, invites, experts, and moderation. Completed.
- Community feed schema. Completed.
- Mobile app feed API. Completed.
- Saved providers and care circle schema. Completed.
- Saved providers and care circle APIs. Completed.
- Comparison lists, care notes, tour plans, and notification preference APIs. Completed.
- Provider portal profile update audit API. Completed.
- Provider-facing profile edit approval status API. Completed.
- Mobile completion and provider profile audit schema. Completed.
- Community post, comment, report, and moderation APIs. Completed.
- Ad placement schema. Completed.
- Ad placement/impression/click APIs. Completed.
- Direct-sold ad placement and creative admin APIs with policy-gated sponsorship disclosures. Completed.
- Marketing campaign schema. Completed.
- Campaign create/generate/publish APIs. Completed.
- Provider growth plans, subscriptions, and entitlements schema. Completed.
- Contract-first provider growth subscription APIs. Completed.
- Provider feature entitlement check API and enforcement hooks. Completed.
- Reviews/reputation schema. Completed.
- Review submit/list and AI response draft APIs. Completed.
- Consent-gated review request campaign APIs. Completed.
- Consent-gated review request send worker API with policy checks and campaign rollups. Completed.
- Review moderation and sentiment scoring APIs with audit-ready schema. Completed.
- Provider reputation readiness API and provider console action. Completed.
- Policy-gated review response publish API. Completed.
- Docker deployment scaffolding. Completed.
- Secret-safe production readiness endpoint. Completed.
- Launch go/no-go checklist API across config, schema, links, aggregation, ads, newsroom, onboarding, and owner items. Completed.
- Owner login with signed admin session cookie, protected backend/admin routes, and website login entry point. Completed.
- Signed-in admin launch checklist panel with refresh against protected backend readiness API. Completed.
- AI newsroom schema. Completed.
- News intake, article draft/publish, and social derivative APIs. Completed.
- Editorial content source registry and RSS import API with policy-gated inbox staging. Completed.
- Newsroom readiness and podcast brief APIs. Completed.
- Public article SEO API and guide pages. Completed.
- Dynamic sitemap, robots policy, and canonical metadata. Completed.
- Open API catalog endpoint. Completed.
- Open API client, key, webhook subscription, delivery queue, and audit schemas/APIs. Completed.
- Partner API key authentication, scope enforcement, rate-limit audit, provider/events partner APIs. Completed.
- Partner API usage analytics API for request volume, blocked/rate-limited calls, key status, webhook delivery volume, top events, OpenAPI/link-health coverage, and admin console visibility. Completed.
- Partner-scoped usage analytics endpoint with usage:read scope enforcement, rate-limit audit, and OpenAPI/link-health coverage. Completed.
- Admin and partner CSV usage analytics exports for reviewable partner API evidence with scoped partner enforcement and admin console access. Completed.
- API usage retention policy metadata with retention cutoff, purge-candidate counts, archive/legal-hold requirements, blocked purge status, CSV evidence fields, and admin console visibility. Completed.
- Partner webhook signature verification endpoint with owned-subscription enforcement, timestamp tolerance, digest comparison, audit evidence, and OpenAPI/link-health coverage. Completed.
- Admin webhook delivery replay endpoint that duplicates failed, blocked, or delivered historical deliveries into fresh queued records with immutable source delivery audit evidence and console access. Completed.
- Webhook replay evidence export API that pairs replayed deliveries to their source deliveries, attempts, replay audit metadata, and CSV/JSON admin evidence downloads. Completed.
- Webhook replay evidence review filters for API client, event type, source/replay status, subject, date window, and audited-only exports with validation and CSV filter metadata. Completed.
- Partner webhook signing guide API with event list, HMAC header contract, deterministic sample payload, failure handling, OpenAPI/link-health coverage, and admin console access. Completed.
- Partner developer docs API and `/developers` page assembled from the live OpenAPI catalog and webhook signing guide with authentication, endpoint, webhook, and operations-control coverage. Completed.
- Webhook event signing SDK examples for Node.js, Python, and partner API curl usage generated from the live signing-guide sample and rendered on `/developers`. Completed.
- Partner sandbox onboarding checklist API and `/developers` section with scoped steps, evidence signals, production blockers, OpenAPI/link-health coverage, and developer-docs JSON wiring. Completed.
- Open API key listing and audited revocation endpoints. Completed.
- Signed webhook delivery worker, dry-run processing, delivery attempt records, and retry-ready schema. Completed.
- Admin Open API operations console for clients, scoped keys, webhooks, dry-run delivery, retries, and audit visibility. Completed.
- Admin operations health charts backed by dashboard metrics for claims, reviews, events, community, APIs, and workers. Completed.
- Scheduled worker health API for expected cron cadence, stale workers, failures, and launch blockers. Completed.
- Scheduled worker alert delivery workflow with dry-run/manual-export payloads, internal notification queue blocker, audit evidence, OpenAPI/link-health coverage, and admin console access. Completed.
- Admin acquisition health API and console panel for 5,000-listing launch readiness, source coverage, image backlog, import queues, crawl queues, blockers, and next actions. Completed.
- Webhook delivery retry API with policy-gated requeue and audit trail. Completed.
- Supabase schema readiness by product capability with live row counts and blocked capability summaries. Completed.
- Browser-safe guard for internal API endpoints. Completed.
- Founder workbench executable workflow UI and API. Completed.
- Admin operations console for import, claim, outreach, and moderation workflows. Completed.
- Senior family action panel for saved providers, care circles, members, and community posts. Completed.
- Admin AI newsroom console for source ingestion, article drafting, publishing, derivatives, and policy checks. Completed.
- Deployment status API and admin link for active Vercel URL, commit, canonical domain, and owner DNS actions. Completed.
- Extracted entity staging and review APIs. Completed.
- Extracted entity approve/reject/duplicate publication workflow. Completed.
- Extracted entity duplicate match scoring. Completed.
- Import batch worker run API. Completed.
- Import batch requeue and shared status helpers for failed, blocked, and partial aggregation jobs. Completed.
- Crawl job create/list/run APIs and unresolved data quality queue API. Completed.
- Aggregation launch readiness API and admin console action. Completed.
- Launch import wave planning API and admin console action. Completed.
- Provider claim outreach queue APIs. Completed.
- Provider outreach requeue API for blocked or bounced claim invites. Completed.
- Family inquiry, free listing, and operator demo intake APIs. Completed.
- Admin lead intake queue API and operations console action. Completed.
- Supabase migration manifest and live table readiness API. Completed.
- Protected Supabase production readiness API and admin console for persistence mode, migration coverage, and blocked capability tracking. Completed.
- Protected Supabase migration bundle API with ordered checksums and admin console action. Completed.
- Context-specific owned visual asset registry, provenance metadata, and readiness API. Completed.
- Context-specific visual assets for local events, newsroom guidance, and trust/safety with surface-mapped readiness metadata. Completed.
- Context-specific visual asset wiring for public article, city, and care-type SEO routes. Completed.
- Policy queue API for review-required, disclosure-required, blocked, and approved policy checks with link-health/OpenAPI coverage. Completed.
- Policy review assignment workflow for legal, expert, and policy-review ownership with SLA due dates, audit events, Supabase schema, OpenAPI/link-health coverage, and admin console access. Completed.
- Audit event export and retention-control workflow with JSON/CSV evidence export, retention candidate preview, live-purge blocker, OpenAPI/link-health coverage, and owner approval parking-lot note. Completed.
- Policy override request and decision APIs with audit-ready Supabase schema, local fallback, and route catalog coverage. Completed.
- Policy override expiry worker API for requested or approved time-bound overrides with audit-ready behavior. Completed.
- Immutable operational audit event browser API with policy override request, decision, and expiry evidence coverage. Completed.
- Launch import source seeding API for approved CMS/current-site/state-license sources and optional starter batches. Completed.
- Launch import execution API for current-site starter batches with explicit CMS/state adapter blockers. Completed.
- Import adapter readiness API for CMS, state license, owner-controlled manual, provider website, RSS, and vendor sources. Completed.
- Source adapter import readiness and direct runner API for approved CMS, state license, and owner-controlled payload records. Completed.
- Scheduled source adapter worker preview/run API for approved CMS, state license, and owner-controlled payload records without fabricated records. Completed.
- Source adapter file manifest ingestion API with checksum, storage verification, mapping readiness, Supabase schema, and local fallback. Completed.
- Source adapter manifest payload loader API that binds supplied records to verified manifests before governed import execution. Completed.
- Source adapter object-storage readiness API with storage scheme detection, owner credential blockers, and manual payload fallback. Completed.
- Source adapter signed object fetch executor API with HTTPS-only fetch, SHA-256 verification, JSON record parsing, governed dry-run import, and audit evidence. Completed.
- Scheduled source manifest signed object fetch worker API for fetch-ready manifests with dry-run safety, per-manifest blockers, and governed import rollups. Completed.
- Protected source manifest fetch cron route with preview/live mode safety and scheduled worker run observability. Completed.
- Vercel daily source manifest fetch cron schedule with preview/live env gate and owner-dependent live-mode parking-lot notes. Completed.
- Vendor feed credential metadata and readiness workflow with contract, vault reference, and field mapping gates. Completed.
- Vendor feed import runner API for ready vendor metadata and source records through the governed import worker. Completed.
- Scheduled vendor feed worker preview/run API for ready vendor metadata and supplied vendor payloads without fabricated records. Completed.
- Provider website parser readiness and crawl-page extraction API with source, robots, and review gates. Completed.
- Provider website parser rule-readiness API with content-depth, senior-care relevance, contact, location, category, conversion, payer, and crawl-status signals. Completed.
- Provider website parser source-specific rule override API with Supabase schema, local fallback, and governed thresholds/keyword tuning. Completed.
- Provider website parser override audit dashboard API with operational audit events, unaudited override blockers, and admin console access. Completed.
- Provider website parser override rollback workflow with dry-run candidate preview, inactive status transition, audit evidence, and admin console access. Completed.
- Provider website parser override replacement workflow with dry-run candidate preview, audited previous/new profile evidence, and admin console access. Completed.
- Provider website parser override impact compare workflow with default/active/replacement stageable deltas, blocker evidence, optional audit event, and admin console access. Completed.
- Provider website parser impact evidence retention in the override audit dashboard, including counted impact comparison events for replacement and rollback review. Completed.
- Provider website parser impact evidence export API with JSON/CSV output, source filter, launch-review totals, OpenAPI/link-health coverage, and admin console access. Completed.
- Provider website parser impact evidence attachment workflow with retained comparison validation, attachment audit event, audit dashboard counts, OpenAPI/link-health coverage, and admin console access. Completed.
- Extracted entity confidence review queue API for approval-ready, human-review, legal-review, image-rights, and duplicate routing. Completed.
- Extracted entity review assignment and SLA API with Supabase migration, local fallback, and admin console action. Completed.
- Import operator escalation report API for overdue, due-soon, unassigned, and blocked extracted-entity reviews. Completed.
- Import escalation notification preview/dispatch API with dry-run safety, manual export payload, and audit evidence. Completed.
- Import escalation delivery readiness API with internal queue blocker reporting and manual export fallback. Completed.
- Import escalation HTTPS internal queue adapter with readiness validation, live dispatch, and audit evidence. Completed.
- Import escalation delivery callback reconciliation API with policy gate and operational audit evidence. Completed.
- Import escalation retry scheduler API with dry-run candidate detection, live retry scheduling audit evidence, and admin console access. Completed.
- Import escalation retry delivery executor API with dry-run batch preview, manual export execution evidence, internal queue readiness gates, and admin console access. Completed.
- Protected import escalation retry cron route with preview/live mode safety, retry scheduling, retry delivery rollups, and scheduled worker run observability. Completed.
- Vercel hourly import escalation retry cron schedule with preview/manual-export default and owner-dependent live queue parking-lot notes. Completed.
- Supabase project credentials. Parked for tomorrow.
- Production hosting confirmation. Parked for tomorrow.

Acceptance:

- `GET /api/v1/providers` returns provider inventory from the backend service.
- `GET /api/v1/providers/{id}` returns one provider with locations, services, and provenance.
- Project typechecks once dependencies are installed.

## Phase 1: 5,000 Listing Launch Engine

Deliverables:

- Source registry.
- Import batches.
- Current live TheSeniorGuru listing crawler and staging adapter. Completed.
- Current-site public JSON acquisition worker for real production listing records. Completed.
- Current-site parsed record preview/export API. Completed.
- CMS/state/public-source import adapters. Direct runner, scheduled payload worker, file manifest ingestion, manifest payload loader, object-storage readiness checks, signed object fetch executor, scheduled signed-object fetch worker, protected source manifest fetch cron route, Vercel source-manifest cron schedule, provider website parser rule readiness, source-specific parser overrides, parser override audit dashboard, override rollback workflow, override replacement workflow, override impact comparison, impact evidence retention, impact evidence export, and impact evidence attachment completed.
- JSON import worker for approved sources. Completed.
- Public-source acquisition staging contract for rich provider/community records, provenance, images, quality gaps, and audit metadata. Completed.
- Public-source sample acquisition worker API with seeded official-directory-style adapter and image coverage report. Completed.
- Real current-site listing acquisition worker API for public TheSeniorGuru.com listings with session-aware import, robots metadata, structured fields, and enrichment-later image staging. Completed.
- Extracted entity launch-quality audit worker for contact, taxonomy, confidence, image coverage, and rights-risk flags. Completed.
- Crawl job control plane for approved sources. Completed.
- Launch import wave planner for the 5,000-listing target. Completed.
- Launch import source seeding for approved starter sources and queued starter batches. Completed.
- Launch import execution status/run API for real current-site starter batches. Completed.
- Entity matching and duplicate detection.
- Entity match scoring and candidate persistence. Completed.
- Confidence scoring.
- Human review queue. Completed.
- Extracted entity approval, rejection, duplicate, audit workflow. Completed.
- Extracted entity review owner assignment and SLA tracking. Completed.
- Import operator escalation reporting. Completed.
- Import escalation delivery notifications, HTTPS internal queue adapter, delivery callback reconciliation, retry scheduling evidence, and retry delivery execution. Completed.
- Vendor feed credential workflow. Completed.
- Vendor feed import runner. Completed.
- Scheduled vendor feed worker. Completed.
- Provider claim outreach queue. Completed.

Launch target:

- 5,000 imported listings.
- 1,000 enriched listings.
- 100 claimed listings.
- 25-50 paid beta providers.

## Phase 2: Search, Profiles, SEO

Deliverables:

- Senior-focused homepage.
- Search/discover page.
- Provider profile page.
- City/category SEO pages.
- Structured data.
- Sponsored label components.

## Phase 3: Claim and Verification Engine

Deliverables:

- Free claim flow.
- Business email/domain verification. Completed.
- Business phone verification. Completed.
- License/document review. Completed.
- Verification evidence and attempt workflow. Completed.
- Provider-facing claim checklist/status API. Completed.
- Policy-gated verification delivery worker and audit payload. Completed.
- Production-safe verification delivery manual fallback when email, SMS, or phone adapters are not live. Completed.
- Owner claim verification queue with readiness, delivery, and blocker status. Completed.
- Profile completion assistant. Completed.
- Provider visibility report. Completed.

## Phase 4: Events Marketplace

Deliverables:

- Provider event creation.
- RSVP flow.
- Event promotion products.
- Sponsored event promotion creation and activation. Completed.
- Reminder/follow-up automation. Completed.
- Attendance and no-show capture with analytics update. Completed.
- Provider-facing event automation reporting with attendance follow-up segmentation. Completed.
- Event analytics. Completed.

## Phase 5: Community and Mobile API

Deliverables:

- Community feed.
- Groups.
- Comments.
- Reports/moderation.
- Community comments, reports, and moderation APIs. Completed.
- Local community group and membership APIs. Completed.
- Local expert profile submission and verification APIs. Completed.
- Community invitation delivery and local topic subscription APIs. Completed.
- App feed API.
- Saved providers and care circles.
- Saved provider and care circle APIs. Completed.
- Comparison lists, care notes, tour plans, and notification preferences. Completed.

## Phase 6: Marketing Growth Engine

Deliverables:

- AI campaign builder.
- AI SEO/blog/social.
- Review campaigns.
- AI chat/voice.
- Provider dashboard and metrics.
- Provider campaign metrics API and console action. Completed.
- Campaign metric event ingestion API with validation, policy check, persistence, and reporting rollup. Completed.
- Provider campaign optimization recommendation API backed by recorded campaign metrics. Completed.
- Provider growth plans and feature entitlements. Completed.
- Paid feature entitlement enforcement. Completed.

## Phase 7: Advertising and Placement Engine

Deliverables:

- Placement inventory.
- Sponsored listing/event/native placements.
- Google Ad Manager/AdSense hooks.
- Impression/click tracking.
- Direct-sold and Google backfill ad readiness API plus admin console action. Completed.
- Direct-sold placement reporting with impressions, clicks, CTR, and next actions. Completed.
- Frequency caps and disclosures. Completed.

## Phase 8: AI Newsroom

Deliverables:

- RSS/news intake.
- Editorial queue.
- AI draft generation.
- Compliance review.
- Social/newsletter/podcast derivatives.
- Byline approval.
- Newsletter edition schema and admin/public APIs. Completed.
- Newsletter approval, scheduling, and send lifecycle APIs. Completed.
- Scheduled RSS intake worker API across approved editorial sources. Completed.
- Content performance metric ingestion and rollup APIs for articles, newsletters, and derivatives. Completed.
- Protected newsroom RSS cron route with preview/live mode safety and scheduled worker run observability. Completed.
- Newsletter delivery provider preview adapter with consent/tracking payload, credential checks, and safe live-send blockers. Completed.
- Policy-gated newsletter delivery send API with dry-run support, delivery-attempt persistence, manual export sent evidence, and Mailjet live-send blockers. Completed.
- Editorial performance trend export API with daily/weekly aggregation, CSV output, policy checks, and OpenAPI/link-health coverage. Completed.
- Preview-first webhook retry scheduler with protected cron route, dry-run candidate reporting, live-mode retry processing, and worker observability. Completed.
- Data source approval queue API with source risk levels, missing review fields, import-readiness gates, policy checks, and OpenAPI/link-health coverage. Completed.
