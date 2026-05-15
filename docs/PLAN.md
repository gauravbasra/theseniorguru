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
- Admin provider claim verification evidence export API with JSON/CSV outputs, checklist rows, attempt summaries, document-review evidence, approval blockers, OpenAPI/link-health/product-map coverage, and launch-inventory next actions. Completed.
- Admin provider claim decision hardening so omitted `dryRun` previews approval/rejection effects without mutating claim/provider state and live decisions require explicit `dryRun=false`. Completed.
- Admin claimed-provider profile edit review queue and decision APIs with policy/audit controls. Completed.
- Admin provider verification queue API for ready, pending-delivery, failed/expired, and not-started claim work. Completed.
- Admin provider verification SLA API for overdue, due-soon, delivery, failed/expired, and review-ready claim work. Completed.
- Admin provider verification SLA alert preview/record API with policy gate, manual export path, and audit-backed internal queue adapter. Completed.
- Admin provider verification delivery readiness API for manual, email, SMS, and phone adapter status. Completed.
- Provider verification transactional email adapter with Mailjet payload preview, explicit live-mode guard, sender approval blockers, and manual fallback evidence. Completed.
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
- Provider-facing profile edit approval status dashboard and console actions backed by profile-update submission/status APIs. Completed.
- Mobile completion and provider profile audit schema. Completed.
- Community post, comment, report, and moderation APIs. Completed.
- Ad placement schema. Completed.
- Ad placement/impression/click APIs. Completed.
- Direct-sold ad placement and creative admin APIs with policy-gated sponsorship disclosures. Completed.
- Marketing campaign schema. Completed.
- Campaign create/generate/publish APIs. Completed.
- Provider growth plans, subscriptions, and entitlements schema. Completed.
- Contract-first provider growth subscription APIs. Completed.
- Provider growth subscription activation hardening so omitted `dryRun` returns policy/audit preview evidence without changing subscription status or entitlements and live activation requires explicit `dryRun=false`. Completed.
- Provider feature entitlement check API and enforcement hooks. Completed.
- Reviews/reputation schema. Completed.
- Review submit/list and AI response draft APIs. Completed.
- Consent-gated review request campaign APIs. Completed.
- Consent-gated review request send worker API with policy checks and campaign rollups. Completed.
- Review moderation and sentiment scoring APIs with audit-ready schema. Completed.
- Provider reputation readiness API and provider console action. Completed.
- Policy-gated review response publish API. Completed.
- Review response publish hardening so omitted `dryRun` returns policy/audit preview evidence without inserting a public response and live publishing requires explicit `dryRun=false`. Completed.
- External review integration readiness API with provider-owned credential references, live-sync blockers, Supabase schema readiness, OpenAPI/link-health coverage, and owner credential parking-lot note. Completed.
- Reputation trend analytics API with review/sentiment buckets, external source signals, auditable score snapshots, Supabase schema readiness, OpenAPI/link-health coverage, and provider route validation. Completed.
- Admin review moderation dashboard API with SLA risk, queue health, provider breakdown, recent decisions, OpenAPI/link-health coverage, and route smoke coverage. Completed.
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
- Webhook replay hardening so omitted `dryRun` previews source deliveries without creating queued replay records and live replay creation requires explicit `dryRun=false`. Completed.
- Partner webhook signing guide API with event list, HMAC header contract, deterministic sample payload, failure handling, OpenAPI/link-health coverage, and admin console access. Completed.
- Partner developer docs API and `/developers` page assembled from the live OpenAPI catalog and webhook signing guide with authentication, endpoint, webhook, and operations-control coverage. Completed.
- Webhook event signing SDK examples for Node.js, Python, and partner API curl usage generated from the live signing-guide sample and rendered on `/developers`. Completed.
- Partner sandbox onboarding checklist API and `/developers` section with scoped steps, evidence signals, production blockers, OpenAPI/link-health coverage, and developer-docs JSON wiring. Completed.
- Partner API version changelog API and `/developers` section with current/planned release entries, deprecation policy, migration notes, OpenAPI/link-health coverage, and developer-docs JSON wiring. Completed.
- Webhook SDK package publishing plan API and `/developers` section with package names, release gates, security controls, owner blockers, OpenAPI/link-health coverage, and developer-docs JSON wiring. Completed.
- Partner sandbox evidence export API with JSON/CSV outputs, onboarding/versioning/endpoint/SDK blocker evidence rows, link-health summary, OpenAPI/link-health coverage, and developer-docs JSON wiring. Completed.
- Partner production smoke suite readiness API with JSON/CSV outputs, scope-by-route smoke assertions, OpenAPI/developer-docs contract checks, client/key/usage readiness totals, live-key guardrails, OpenAPI/link-health/product-map coverage, and owner-dependent production execution blocker. Completed.
- Partner response envelope versioning with runtime envelope headers/meta for authenticated partner routes, response-envelope contract API, `/developers` section, OpenAPI/link-health coverage, and developer-docs JSON wiring. Completed.
- Partner response pagination contract with runtime page/pageSize metadata for partner provider and event APIs, response-pagination contract API, `/developers` section, OpenAPI/link-health coverage, and developer-docs JSON wiring. Completed.
- Partner cursor pagination evaluation API with JSON/CSV exports, endpoint-by-endpoint cursor candidates, migration gates, current offset-pagination recommendation, `/developers` section, OpenAPI/link-health/product-map coverage, and owner-safe implementation blockers. Completed.
- Partner provider detail API with `providers:read` scope, id/slug lookup metadata, source provenance, internal admin/claim evidence exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner provider visibility readiness API with `providers:read` scope, aggregate scores/metrics, public missing-field labels, internal URL/entitlement/audit exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner provider reputation readiness API with `reviews:read` scope, aggregate review/campaign/sentiment health, reviewer/request/moderation identity exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner provider review summary API with `reviews:read` scope, aggregate published-review counts, rating/source/sentiment metrics, raw review text and reviewer identity exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner provider event summary API with `events:read` scope, provider-scoped event counts, aggregate RSVP/promotion/ad metrics, attendee PII and per-RSVP row exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner provider community summary API with `community:read` scope, provider-scoped published-post counts, sponsorship/type/location metrics, author/body/comment/member/moderation exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner provider ad summary API with `ads:read` scope, provider-scoped delivery totals, placement rollups, ad health/recommendations, creative payload/destination/user-context/request-row exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner provider campaign summary API with `campaigns:read` scope, provider-scoped campaign/asset/metric rollups, type/status/channel distributions, audience/asset/metric payload exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner event analytics API with `events:read` scope, aggregate RSVP/promotion/ad metrics, attendee PII exclusion, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner published reviews API with `reviews:read` scope, privacy-safe reviewer fields, provider context, pagination/envelope metadata, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner published community posts API with `community:read` scope, published-only filtering, location/type/provider/community filters, disclosure-preserving payloads, pagination/envelope metadata, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner published newsroom articles API with `newsroom:read` scope, published-only filtering, attribution metadata, preview-only body text, pagination/envelope metadata, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner public newsletter editions API with `newsroom:read` scope, public-status filtering, recipient-safe metadata, linked article references, pagination/envelope metadata, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner aggregated newsroom performance API with `newsroom:read` scope, article/newsletter filters, channel/top-content rollups, raw payload exclusion, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner newsroom syndication readiness API with `newsroom:read` scope, source/article/derivative aggregate blockers, draft/source/admin detail exclusion, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner approved newsroom source registry API with `newsroom:read` scope, approved-only attribution metadata, source-type/search filters, pagination/envelope metadata, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner ad placement inventory API with `ads:read` scope, active/surface/placement filters, disclosure metadata, optional delivery preview payloads, pagination/envelope metadata, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner published campaigns API with `campaigns:read` scope, published/non-blocked filtering, provider/type/status filters, optional provider metrics rollup, pagination/envelope metadata, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner claim/data-correction submission API with `claims:write` scope, shared claim service path, verification attempt creation, status checklist evidence, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner claim status API with `claims:write` scope, claimant-email match guard, verification checklist evidence, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner claim verification evidence submission API with `claims:write` scope, claimant-email match guard, attestation enforcement, shared verification service path, raw evidence/target/policy exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Partner production promotion workflow with sandbox evidence checks, active key/subscription/usage gates, owner approval guard, sandboxMode promotion update, API audit evidence, OpenAPI/link-health coverage, product map, and Open API console action. Completed.
- Open API key listing and audited revocation endpoints. Completed.
- Signed webhook delivery worker, dry-run processing, delivery attempt records, and retry-ready schema. Completed.
- Webhook delivery worker dry-run hardening so admin-run previews no longer persist delivery attempts or mutate delivery status unless explicitly run live. Completed.
- Webhook delivery service and operations cron hardening so omitted `dryRun` and scheduled operations runs preview queued deliveries without persisting attempts or mutating status; live processing remains explicit through approved run/scheduler paths. Completed.
- Operations cron safety hardening so verification expiry, webhook delivery, and event automation all run in preview mode from the scheduled route; focused admin endpoints require explicit `dryRun=false` for state mutation. Completed.
- Admin Open API operations console for clients, scoped keys, webhooks, dry-run delivery, retries, and audit visibility. Completed.
- Admin operations health charts backed by dashboard metrics for claims, reviews, events, community, APIs, and workers. Completed.
- Scheduled worker health API for expected cron cadence, stale workers, failures, and launch blockers. Completed.
- Cron live approval dashboard API with JSON/CSV outputs, per-cron env gate evidence, owner approval blockers, route guardrails, OpenAPI/link-health/product-map coverage, and safe preview-mode next actions. Completed.
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
- Production cutover readiness API for canonical domain, Vercel production alias, persistent Supabase mode, launch checklist, DNS owner approval, rollback evidence, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- Production rollback evidence export API with deployment metadata, cutover blockers, link-health status, rollback steps, JSON/CSV output, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- DNS cutover approval recorder API with audited owner approval/deferral evidence, cutover readiness integration, OpenAPI/link-health coverage, product map updates, and admin console action. Completed.
- Public-domain smoke runner API with public page fetch checks, final-domain readiness gates, audit evidence, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- Public-domain smoke runner public runtime-marker API probe with server/runtime header evidence so Apache, wrong-origin, expired-cert, and non-Next responses become launch blockers. Completed.
- Public runtime marker added to link-health and production-operations product map so launch readiness catches accidental removal or route protection. Completed.
- Production origin diagnostics API with final-domain and active-deployment runtime marker probes, Apache/old-origin classification, OpenAPI/link-health/product-map coverage, and DNS cutover next-action evidence. Completed.
- Live credential installation runbook API with no-secret review audit, credential family blockers, validation steps, JSON/CSV output, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- Post-cutover synthetic monitor API with deployment, DNS approval, persistence, credential, cutover, rollback, link-health probes, audit-run recording, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- Post-cutover monitor alert delivery API with manual-export archive, internal notification queue readiness guard, audit evidence, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- Production credential smoke evidence export API with credential-level validation rows, JSON/CSV output, audit archiving, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- Credential evidence retention dashboard API with archive counts, retention cutoff/candidates, CSV export, blocked live purge guardrail, audit review evidence, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- DNS cutover change-window smoke checklist API with pre-change, DNS-change, post-change, rollback phases, route evidence requirements, audit archiving, OpenAPI/link-health coverage, product map, and admin console action. Completed.
- Extracted entity staging and review APIs. Completed.
- Extracted entity approve/reject/duplicate publication workflow. Completed.
- Extracted entity duplicate match scoring. Completed.
- Extracted entity merge-readiness API with matched-provider field comparison, safe missing-field update plan, blocker reporting, optional audit evidence, OpenAPI/link-health coverage, and admin console action. Completed.
- Extracted entity decision hardening so approve, reject, and duplicate reviewer actions default to dry-run previews and require explicit `dryRun=false` before mutating review status or publishing provider updates. Completed.
- Import batch worker run API. Completed.
- Import batch evidence export API with JSON/CSV outputs, staged entity rows, quality-gap blockers, launch target next actions, OpenAPI/link-health/product-map coverage, and route smoke coverage. Completed.
- Import batch and public-source acquisition worker dry-run hardening so missing `dryRun` stays preview-only and live persisted staging requires explicit `dryRun=false`. Completed.
- Import batch requeue and shared status helpers for failed, blocked, and partial aggregation jobs. Completed.
- Crawl job create/list/run APIs and unresolved data quality queue API. Completed.
- Aggregation launch readiness API and admin console action. Completed.
- Launch import wave planning API and admin console action. Completed.
- Provider claim outreach queue APIs. Completed.
- Provider outreach requeue API for blocked or bounced claim invites. Completed.
- Provider claim outreach send hardening so omitted `dryRun` previews policy-approved delivery without mutating queued state and live sent state requires explicit `dryRun=false`. Completed.
- Family inquiry, free listing, and operator demo intake APIs. Completed.
- Admin lead intake queue API and operations console action. Completed.
- Supabase migration manifest and live table readiness API. Completed.
- Protected Supabase production readiness API and admin console for persistence mode, migration coverage, and blocked capability tracking. Completed.
- Protected Supabase migration bundle API with ordered checksums and admin console action. Completed.
- Supabase activation review API with migration bundle checksum confirmation, env-key review evidence, no-secret blocking, owner approval gate, audit event persistence, OpenAPI/link-health/product-map coverage, and admin readiness wiring. Completed.
- Context-specific owned visual asset registry, provenance metadata, and readiness API. Completed.
- Context-specific visual assets for local events, newsroom guidance, and trust/safety with surface-mapped readiness metadata. Completed.
- Context-specific visual asset wiring for public article, city, and care-type SEO routes. Completed.
- Policy queue API for review-required, disclosure-required, blocked, and approved policy checks with link-health/OpenAPI coverage. Completed.
- Policy review assignment workflow for legal, expert, and policy-review ownership with SLA due dates, audit events, Supabase schema, OpenAPI/link-health coverage, and admin console access. Completed.
- Policy review decision dashboard API with JSON/CSV outputs, assignment SLA status, reviewer role-fit checks, ready-for-decision rows, unassigned candidate counts, OpenAPI/link-health/product-map coverage, and launch-review controls. Completed.
- Audit event export and retention-control workflow with JSON/CSV evidence export, retention candidate preview, live-purge blocker, OpenAPI/link-health coverage, and owner approval parking-lot note. Completed.
- Policy override request and decision APIs with audit-ready Supabase schema, local fallback, and route catalog coverage. Completed.
- Policy override expiry worker API for requested or approved time-bound overrides with audit-ready behavior. Completed.
- Immutable operational audit event browser API with policy override request, decision, and expiry evidence coverage. Completed.
- Launch import source seeding API for approved CMS/current-site/state-license sources and optional starter batches. Completed.
- Launch import execution API for current-site starter batches with explicit CMS/state adapter blockers. Completed.
- Launch import execution live-mode owner approval gate with explicit approval env metadata, blocked live-run evidence, and owner-dependent parking-lot note. Completed.
- Import adapter readiness API for CMS, state license, owner-controlled manual, provider website, RSS, and vendor sources. Completed.
- Source adapter import readiness and direct runner API for approved CMS, state license, and owner-controlled payload records. Completed.
- Scheduled source adapter worker preview/run API for approved CMS, state license, and owner-controlled payload records without fabricated records. Completed.
- Source adapter file manifest ingestion API with checksum, storage verification, mapping readiness, Supabase schema, and local fallback. Completed.
- Source adapter manifest payload loader API that binds supplied records to verified manifests before governed import execution. Completed.
- Source adapter object-storage readiness API with storage scheme detection, owner credential blockers, and manual payload fallback. Completed.
- Source adapter signed object fetch executor API with HTTPS-only fetch, SHA-256 verification, JSON record parsing, governed dry-run import, and audit evidence. Completed.
- Scheduled source manifest signed object fetch worker API for fetch-ready manifests with dry-run safety, per-manifest blockers, and governed import rollups. Completed.
- Protected source manifest fetch cron route with preview/live mode safety and scheduled worker run observability. Completed.
- Source manifest fetch cron live-mode owner approval gate with explicit approval env metadata, blocked worker-run evidence, readiness reporting, and route smoke coverage. Completed.
- Vercel daily source manifest fetch cron schedule with preview/live env gate and owner-dependent live-mode parking-lot notes. Completed.
- Source manifest production credential readiness API with non-secret credential reference checks, path allow-list checks, owner approval metadata, CSV evidence export, OpenAPI/link-health/product-map wiring, and owner-dependent credential parking-lot notes. Completed.
- Partner aggregation readiness API with `providers:read` scope, aggregate source/import/crawler/quality health, source URL/terms/queue/import/crawler/quality row exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
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
- Duplicate merge review dashboard API with JSON/CSV outputs, duplicate-risk rows, merge-readiness status, conflict/proposed-update evidence, assignment/SLA signals, OpenAPI/link-health/product-map coverage, and reviewer next actions. Completed.
- Import operator escalation report API for overdue, due-soon, unassigned, and blocked extracted-entity reviews. Completed.
- Import escalation notification preview/dispatch API with dry-run safety, manual export payload, and audit evidence. Completed.
- Import escalation delivery readiness API with internal queue blocker reporting and manual export fallback. Completed.
- Import escalation HTTPS internal queue adapter with readiness validation, live dispatch, and audit evidence. Completed.
- Import escalation delivery callback reconciliation API with policy gate and operational audit evidence. Completed.
- Import escalation retry scheduler API with dry-run candidate detection, live retry scheduling audit evidence, and admin console access. Completed.
- Import escalation retry delivery executor API with dry-run batch preview, manual export execution evidence, internal queue readiness gates, and admin console access. Completed.
- Import escalation retry cron live-mode owner approval gate with explicit approval env metadata, blocked worker-run evidence, readiness reporting, and route smoke coverage. Completed.
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
- Source acquisition cron live-mode owner approval gate with explicit approval env metadata, blocked worker-run evidence, readiness reporting, and route smoke coverage. Completed.
- Current-site parsed record preview/export API. Completed.
- CMS/state/public-source import adapters. Direct runner, scheduled payload worker, file manifest ingestion, manifest payload loader, object-storage readiness checks, source-object credential readiness, signed object fetch executor, scheduled signed-object fetch worker, protected source manifest fetch cron route, Vercel source-manifest cron schedule, provider website parser rule readiness, source-specific parser overrides, parser override audit dashboard, override rollback workflow, override replacement workflow, override impact comparison, impact evidence retention, impact evidence export, and impact evidence attachment completed.
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
- Provider verification delivery send hardening so omitted `dryRun` returns non-mutating preview evidence and live delivery requires explicit `dryRun=false`. Completed.
- Owner claim verification queue with readiness, delivery, and blocker status. Completed.
- Profile completion assistant. Completed.
- Provider visibility report. Completed.

## Phase 4: Events Marketplace

Deliverables:

- Provider event creation.
- RSVP flow.
- Event promotion products.
- Sponsored event promotion creation and activation. Completed.
- Sponsored event promotion activation hardening so omitted `dryRun` returns policy/audit preview evidence without changing promotion status and live activation requires explicit `dryRun=false`. Completed.
- Reminder/follow-up automation. Completed.
- Reminder/follow-up delivery provider adapter with dry-run preview, manual export guard, internal queue processing, sent-state updates, and audit evidence. Completed.
- Attendance and no-show capture with analytics update. Completed.
- Provider-facing event automation reporting with attendance follow-up segmentation. Completed.
- Provider-facing event follow-up composer with tone/CTA controls, merge fields, recommended segments, audit evidence, and Supabase composition snapshot readiness. Completed.
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
- Community invitation delivery hardening so omitted `dryRun` returns policy/audit preview evidence without marking invitations sent and live delivery requires explicit `dryRun=false`. Completed.
- App feed API.
- Saved providers and care circles.
- Saved provider and care circle APIs. Completed.
- Comparison lists, care notes, tour plans, and notification preferences. Completed.
- Signed senior/caregiver app session API with consumer profile binding and session-aware mobile action routes. Completed.
- Session-bound app device registration API with push-token validation, audit evidence, fallback persistence, and Supabase migration readiness. Completed.
- Community digest delivery worker with topic subscription targeting, app feed payload preview, device-target counts, internal queue audit evidence, and Supabase delivery-job migration readiness. Completed.
- Session-owned care-circle family invite delivery jobs with preview, manual export, internal queue audit evidence, and delivery metadata persistence. Completed.
- Expert answer ranking API with verified expert scoring, location/specialty routing reasons, audit event evidence, and Supabase ranking snapshot readiness. Completed.
- Local trust score API with community activity, verified expert, topic subscription, feed, moderation-load signals, audit event evidence, and Supabase score snapshot readiness. Completed.

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
- Review request delivery provider adapter with dry-run preview, manual export guard, internal queue sent-state processing, per-request delivery payload evidence, and audit event coverage. Completed.
- Review request campaign send hardening so omitted `dryRun` returns preview evidence without mutating queued requests and live send processing requires explicit `dryRun=false`. Completed.
- AI voice assistant adapter readiness and configuration API with entitlement checks, manual/internal queue fallback, live voice provider blockers, compliance payload evidence, audit events, and Supabase schema readiness. Completed.
- Campaign optimization recommendation action workflow with create-task, internal queue, review, and dismissal actions backed by policy checks, persistence, audit evidence, OpenAPI/link-health coverage, and Supabase schema readiness. Completed.
- Provider campaign publish hardening so omitted `dryRun` returns policy/audit preview evidence without mutating campaign status and live publish processing requires explicit `dryRun=false`. Completed.

## Phase 7: Advertising and Placement Engine

Deliverables:

- Placement inventory.
- Sponsored listing/event/native placements.
- Google Ad Manager/AdSense hooks.
- Impression/click tracking.
- Direct-sold and Google backfill ad readiness API plus admin console action. Completed.
- Google Ad Manager sync preview/manual-export workflow with ad-unit payload evidence, direct-sold-first backfill guardrails, audit events, and Supabase schema readiness. Completed.
- Google Ad Manager sync hardening so manual-export and Google modes remain preview-only unless `dryRun=false` is explicitly provided. Completed.
- Direct-sold placement reporting with impressions, clicks, CTR, and next actions. Completed.
- Provider-facing ad campaign reporting API with provider-owned creative filtering, placement metrics, health status, and next actions. Completed.
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
- Newsroom RSS cron live-mode owner approval gate with explicit approval env metadata, blocked worker-run evidence, readiness reporting, and route smoke coverage. Completed.
- Newsroom RSS import and scheduled-run hardening so omitted `dryRun` previews feed items and live staging requires explicit `dryRun=false`. Completed.
- Newsletter delivery provider preview adapter with consent/tracking payload, credential checks, and safe live-send blockers. Completed.
- Policy-gated newsletter delivery send API with dry-run support, delivery-attempt persistence, manual export sent evidence, and Mailjet live-send blockers. Completed.
- Editorial performance trend export API with daily/weekly aggregation, CSV output, policy checks, and OpenAPI/link-health coverage. Completed.
- Provider-facing newsletter analytics API with provider-tagged opens/clicks/leads, delivery health, manual/Mailjet blocker visibility, OpenAPI/link-health coverage, and route smoke coverage. Completed.
- Mailjet/manual audience-recipient export API with consent segment evidence, synthetic sample recipients, sender/live/owner approval gates, OpenAPI/link-health coverage, and route smoke coverage. Completed.
- Newsletter delivery send hardening so omitted `dryRun` returns preview delivery evidence and live/manual sent evidence requires explicit `dryRun=false`. Completed.
- Newsroom article publish hardening so omitted `dryRun` returns policy/audit preview evidence without changing approved article status and live publishing requires explicit `dryRun=false`. Completed.
- Newsletter scheduling hardening so omitted `dryRun` returns policy/audit preview evidence without changing approved edition status and live scheduling requires explicit `dryRun=false`. Completed.
- Partner provider newsletter summary API with `newsroom:read` scope, provider-scoped newsletter delivery/performance rollups, recipient/delivery payload/raw metric exclusions, OpenAPI catalog entry, and developer-docs evidence wiring. Completed.
- Preview-first webhook retry scheduler with protected cron route, dry-run candidate reporting, live-mode retry processing, and worker observability. Completed.
- Webhook retry cron live-mode owner approval gate with explicit approval env metadata, blocked worker-run evidence, readiness reporting, and route smoke coverage. Completed.
- Data source approval queue API with source risk levels, missing review fields, import-readiness gates, policy checks, and OpenAPI/link-health coverage. Completed.
