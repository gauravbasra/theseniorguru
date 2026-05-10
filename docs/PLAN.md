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
- Community post, comment, report, and moderation APIs. Completed.
- Ad placement schema. Completed.
- Ad placement/impression/click APIs. Completed.
- Marketing campaign schema. Completed.
- Campaign create/generate/publish APIs. Completed.
- Provider growth plans, subscriptions, and entitlements schema. Completed.
- Contract-first provider growth subscription APIs. Completed.
- Reviews/reputation schema. Completed.
- Review submit/list and AI response draft APIs. Completed.
- Docker deployment scaffolding. Completed.
- Secret-safe production readiness endpoint. Completed.
- AI newsroom schema. Completed.
- News intake, article draft/publish, and social derivative APIs. Completed.
- Open API catalog endpoint. Completed.
- Extracted entity staging and review APIs. Completed.
- Extracted entity approve/reject/duplicate publication workflow. Completed.
- Extracted entity duplicate match scoring. Completed.
- Import batch worker run API. Completed.
- Provider claim outreach queue APIs. Completed.
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

## Phase 6: Marketing Growth Engine

Deliverables:

- AI campaign builder.
- AI SEO/blog/social.
- Review campaigns.
- AI chat/voice.
- Provider dashboard and metrics.
- Provider growth plans and feature entitlements. Completed.

## Phase 7: Advertising and Placement Engine

Deliverables:

- Placement inventory.
- Sponsored listing/event/native placements.
- Google Ad Manager/AdSense hooks.
- Impression/click tracking.
- Frequency caps and disclosures.

## Phase 8: AI Newsroom

Deliverables:

- RSS/news intake.
- Editorial queue.
- AI draft generation.
- Compliance review.
- Social/newsletter/podcast derivatives.
- Byline approval.
