# AGENTS.md

This repository is for **theseniorguru.com**.

The feature requirement document is the build bible:

- `/Users/gbpersonal/Documents/New project/docs/senior-community-growth-platform-frd.md`
- `/Users/gbpersonal/Documents/New project/docs/senior-care-marketplace-research.md`

## Non-Negotiable Rule

No UI-only work. Every feature must include backend routes/server actions, database persistence, business logic, integrations where relevant, error handling, analytics/audit behavior, policy guardrails, and verification.

## Product North Star

The Senior Guru is a community-first senior services network:

- Free listings.
- Free direct contact.
- Free baseline chat.
- Paid provider growth engine.
- Mobile-first senior/caregiver community.
- Events, reviews, local resources, ads, AI marketing, AI newsroom, and open APIs.
- No referral-fee monetization.

## Build Order

1. Provider inventory core.
2. Data aggregation/source registry.
3. Search, profile, and SEO page engine.
4. Claim and verification engine.
5. Events marketplace.
6. Community/mobile feed API.
7. Marketing growth engine.
8. Reviews/reputation engine.
9. Advertising and placement engine.
10. AI newsroom.
11. Open APIs and webhooks.

## Hard Guardrails

- Sponsored content must be labeled.
- AI output must store source inputs, generated output, approval state, and audit trail.
- Crawlers cannot run without registered source approval.
- Imported listing fields must store provenance.
- Outreach cannot run without consent/opt-out rules where required.
- Reviews cannot be faked, gated, or selectively suppressed.
- Health/legal/financial/senior-care claims require policy checks.
- Admin overrides require audit records; some policy blocks are non-overridable.

## Completion Checklist

Before calling any feature done, document:

- Database migration/table(s).
- Route handler/server action.
- Service/business logic.
- UI surface.
- Policy/audit behavior.
- Verification command and result.

