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
- Provider onboarding readiness API across claim, verification, outreach, reputation, and growth. Completed.
- Admin claim approve/reject workflow. Completed.
- Event marketplace schema. Completed.
- Event publish and RSVP APIs. Completed.
- Sponsored event promotion APIs. Completed.
- Event promotion to ad creative activation workflow. Completed.
- Event analytics API. Completed.
- Community feed schema. Completed.
- Mobile app feed API. Completed.
- Saved providers and care circle schema. Completed.
- Saved providers and care circle APIs. Completed.
- Comparison lists, care notes, tour plans, and notification preference APIs. Completed.
- Provider portal profile update audit API. Completed.
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
- Open API key listing and audited revocation endpoints. Completed.
- Signed webhook delivery worker, dry-run processing, delivery attempt records, and retry-ready schema. Completed.
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
- CMS/state/public-source import adapters.
- JSON import worker for approved sources. Completed.
- Public-source acquisition staging contract for rich provider/community records, provenance, images, quality gaps, and audit metadata. Completed.
- Public-source sample acquisition worker API with seeded official-directory-style adapter and image coverage report. Completed.
- Crawl job control plane for approved sources. Completed.
- Launch import wave planner for the 5,000-listing target. Completed.
- Entity matching and duplicate detection.
- Entity match scoring and candidate persistence. Completed.
- Confidence scoring.
- Human review queue.
- Extracted entity approval, rejection, duplicate, audit workflow. Completed.
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
- Business email/domain verification.
- Business phone verification.
- License/document review.
- Verification evidence and attempt workflow. Completed.
- Provider-facing claim checklist/status API. Completed.
- Profile completion assistant.
- Provider visibility report.

## Phase 4: Events Marketplace

Deliverables:

- Provider event creation.
- RSVP flow.
- Event promotion products.
- Sponsored event promotion creation and activation. Completed.
- Reminder/follow-up automation.
- Event analytics. Completed.

## Phase 5: Community and Mobile API

Deliverables:

- Community feed.
- Groups.
- Comments.
- Reports/moderation.
- Community comments, reports, and moderation APIs. Completed.
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
- Frequency caps and disclosures.

## Phase 8: AI Newsroom

Deliverables:

- RSS/news intake.
- Editorial queue.
- AI draft generation.
- Compliance review.
- Social/newsletter/podcast derivatives.
- Byline approval.
