# AGENTS.md

This repository is for **theseniorguru.com**.

The feature requirement document is the build bible:

- `docs/senior-community-growth-platform-frd.md`
- `docs/senior-care-marketplace-research.md`

## Non-Negotiable Rule

No UI-only work. Every feature must include backend routes/server actions, database persistence, business logic, integrations where relevant, error handling, analytics/audit behavior, policy guardrails, and verification.

## Enterprise Feature Rule

Think through every feature end to end before and during implementation. A feature is not a screen, a table, or an isolated endpoint; it is an enterprise workflow. For each feature, design and build the user journey, backend model, API surface, business rules, policy checks, admin/provider/consumer touchpoints, analytics, audit trail, monetization hooks, error states, verification, and deployment implications. The project discussions and FRD are the North Pole for product judgment.

## Messaging Layer Rule

Messaging is a separate product layer. Do not scatter positioning copy randomly through UI, ads, onboarding, emails, AI output, or newsroom content. Maintain distinct audience messaging for families, seniors, providers, advertisers, community experts, and admins. Claims must be compliance-safe, empathetic, direct, and reusable. Product screens may render messaging, but the strategy, tone, claims, disclaimers, and conversion language must be designed as a system.

## Autonomy Rule

Continue working until the current project phase is genuinely finished. Do not stop just because a dependency is missing. If a task depends on the owner, credentials, DNS authority, billing access, production secrets, app-store accounts, legal review, or server confirmation, park that dependency in `docs/parking-lot/` with the exact question/action needed for tomorrow, then continue on independent implementation work.

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
