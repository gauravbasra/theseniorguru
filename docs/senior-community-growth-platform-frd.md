# Senior Community Growth Platform FRD

Date: 2026-05-10
Status: Build Bible / Feature Requirement Document

## 1. Product Thesis

We are not building an A Place for Mom clone. We are building a community-first senior services network where every legitimate provider can be listed and contacted for free, while providers pay for growth, presence, reputation, campaigns, events, and advertising.

The core strategic shift:

- A Place for Mom rents providers crisis-stage leads and move-ins.
- We build providers' owned local demand, reputation, community presence, and always-on marketing.
- Families and seniors get a complete, transparent directory and community app without referral manipulation.
- Providers get free baseline visibility and can upgrade into a local growth engine.

The product is a hybrid of:

- A complete senior services directory.
- Yelp-style local reviews and discovery.
- Nextdoor-style local community engagement.
- Provider event marketplace.
- AI marketing automation platform.
- Mobile caregiver/senior companion app.
- Advertising network for senior-care local intent.

## 2. Non-Negotiable Build Guardrail

This FRD is the execution contract. No feature is complete if it is only UI.

Every feature must include:

- Frontend web and/or mobile UI.
- Backend routes or server actions.
- Database schema and persistence.
- Business rules.
- Admin/provider controls where relevant.
- Integration adapters where relevant.
- Analytics and audit events.
- Error states and moderation states.
- API documentation for third-party access.
- Verification via tests, smoke scripts, or endpoint checks.

Completion requires naming the route, controller/service, database tables, UI surface, business rule, and verification result.

## 3. Strategic Positioning

### Consumer Promise

Find every senior care and senior life resource near you, not just paid referral partners.

### Provider Promise

Your listing is free. Your growth engine is paid.

### Market Promise

No referral commissions. No hidden pay-to-play recommendations. Direct contact stays free. Paid placements and sponsored content are clearly labeled.

### Core Slogan

Be found before families are in crisis, be trusted when they compare, and be reachable when they need help.

## 4. Primary User Segments

### Seniors

- Need local resources, events, social connection, help, discounts, service discovery, and easy communication.
- Mobile app must be senior-friendly, accessible, and low-friction.

### Family Caregivers

- Often adult children making urgent decisions.
- Need search, compare, save, share, ask questions, book tours, track notes, and communicate with providers.

### Providers / Operators

Includes assisted living, memory care, home care, adult day care, senior centers, transportation, medical centers, elder law, Medicare advisors, hospice, therapy, meal delivery, downsizing, senior real estate, and local nonprofits.

Need free listing, paid growth tools, campaign distribution, reviews, events, leads/contact messages, analytics, and reputation management.

### Local Experts

Elder law attorneys, Medicare brokers, social workers, financial planners, senior move managers, discharge planners, and caregiving educators.

Need authority-building, Q&A participation, events, sponsorships, and profile visibility.

### Platform Admins

Need data ingestion, provider verification, campaign moderation, ad placement management, community safety, analytics, billing/contracts, and compliance controls.

## 5. Monetization Model

### Free Forever

- Provider listing.
- Direct provider contact.
- Basic profile.
- Basic chat/contact inbox.
- Consumer search.
- Consumer app access.
- Community participation with safety limits.

### Paid Provider Growth Plans

Contracts should be 3, 6, and 12 months with clear auto-renew terms.

Starter Growth:
- Enhanced profile.
- AI chat profile assistant.
- Campaign templates.
- Basic analytics.
- Event listing boost credits.

Growth Plus:
- AI SEO/blog campaigns.
- AI social media campaigns.
- Review request and response management.
- Featured local placements.
- App feed promotion credits.
- Monthly performance report.

Authority Plan:
- Local authority content cluster.
- Sponsored city/category placements.
- Event promotion bundle.
- AI voice/missed-call handling.
- Advanced reputation monitoring.
- Competitor/ranking reports.
- Priority moderation and verification.

### Add-On Revenue

- Review management add-on.
- AI voice add-on.
- Event promotion package.
- Sponsored content/native article.
- Newsletter sponsorship.
- App push notification sponsorship.
- City/category sponsorship.
- Featured provider carousel.
- Google Ad Manager / AdSense placements where policy-compliant.
- Direct-sold display/native inventory.
- API/data licensing for approved partners.

### Revenue Target

Initial target: 1,000 paying providers.

Baseline:
- 1,000 providers x $100/month equivalent = $100,000 MRR.

Expansion:
- Review management and campaign add-ons can double ARPA for engaged providers.

## 6. Core Product Pillars

### Pillar A: Complete Senior Services Directory

Free listings for:

- Assisted living.
- Memory care.
- Independent living.
- Nursing homes / SNFs.
- Home care.
- Home health.
- Hospice.
- Adult day care.
- Medical centers and clinics.
- Rehab and therapy.
- Transportation.
- Meals and nutrition.
- Senior centers.
- Medicare/insurance help.
- Elder law.
- Financial planning.
- Downsizing/move management.
- Medical alert and safety.
- Caregiver support.
- Local nonprofits and government resources.

Requirements:

- Search by location, category, care type, budget, insurance/payment type, language, amenities, distance, rating, license status, and availability.
- Profile pages must include source provenance and freshness.
- Paid/sponsored/verified states must be visually distinct and clearly labeled.
- Direct phone, website, directions, and message/contact actions must remain free.

Backend requirements:

- `providers`
- `provider_locations`
- `provider_categories`
- `provider_services`
- `provider_claims`
- `provider_contacts`
- `provider_source_records`
- `provider_verifications`
- `provider_media`
- `provider_availability`
- `provider_profile_audits`

APIs:

- `GET /api/v1/providers`
- `GET /api/v1/providers/{id}`
- `POST /api/v1/providers/{id}/claim`
- `POST /api/v1/providers/{id}/contact`
- `PATCH /api/v1/provider-portal/providers/{id}`
- `GET /api/v1/categories`
- `GET /api/v1/locations/search`

### Pillar B: Mobile App as Retention Layer

Mobile is not optional. It is the sticky consumer layer and the community engine.

Core app features:

- Local senior services search.
- Saved providers.
- Provider compare.
- Caregiver notes.
- Tour/appointment tracker.
- Family sharing.
- Ask AI care assistant.
- Local events feed.
- Community feed.
- Groups.
- Provider chat.
- Emergency/resource shortcuts.
- Senior discounts and offers.
- Review submission.
- Push notifications with strict consent controls.

Backend requirements:

- `consumer_profiles`
- `care_circles`
- `saved_providers`
- `comparison_lists`
- `care_notes`
- `tour_plans`
- `app_notification_preferences`
- `user_devices`
- `app_sessions`

APIs:

- `POST /api/v1/auth/mobile/session`
- `GET /api/v1/me`
- `POST /api/v1/me/saved-providers`
- `POST /api/v1/care-circles`
- `POST /api/v1/tour-plans`
- `GET /api/v1/app/feed`
- `PATCH /api/v1/me/notification-preferences`

### Pillar C: Community Network

The community layer should feel closer to Nextdoor/Yelp than a static directory.

Community surfaces:

- City/neighborhood feed.
- Category feed.
- Provider posts.
- Local expert posts.
- Questions and answers.
- Recommendations.
- Events.
- Support groups.
- Senior discounts.
- Safety alerts.
- Local resource announcements.

Post types:

- Question.
- Recommendation.
- Event.
- Provider update.
- Expert answer.
- Educational tip.
- Offer.
- Safety alert.
- Support request.

Trust/safety requirements:

- Moderation queue.
- Abuse reporting.
- Scam detection.
- Provider verification badges.
- Expert verification badges.
- No predatory direct messages.
- No medical diagnosis claims by AI or unverified users.
- Community guidelines enforcement.
- Sponsored labels for paid posts.

Backend requirements:

- `communities`
- `community_memberships`
- `community_posts`
- `community_comments`
- `community_reactions`
- `community_groups`
- `community_reports`
- `moderation_cases`
- `expert_profiles`
- `provider_posts`

APIs:

- `GET /api/v1/communities/{slug}/feed`
- `POST /api/v1/communities/{slug}/posts`
- `POST /api/v1/posts/{id}/comments`
- `POST /api/v1/posts/{id}/report`
- `POST /api/v1/groups`
- `POST /api/v1/groups/{id}/join`
- `GET /api/v1/moderation/cases`

### Pillar D: Provider Events Marketplace

Provider events are a major monetization surface and a community engagement loop.

Event types:

- Open houses.
- Memory care education nights.
- Caregiver support groups.
- Medicare seminars.
- Fall prevention workshops.
- Dementia Q&A.
- Senior fitness.
- Veteran benefits sessions.
- Estate planning seminars.
- Downsizing workshops.
- Wellness checks.
- Holiday lunches.
- Respite care intro days.

Free event features:

- Basic event listing.
- Event page.
- RSVP collection up to a free limit.

Paid event features:

- Featured event placement.
- City/category sponsorship.
- App feed promotion.
- Push notification campaign.
- Email newsletter inclusion.
- AI flyer generation.
- AI social posts.
- RSVP reminder texts/emails.
- Post-event follow-up campaign.
- Retargeting audience.
- Event analytics.
- Review request automation.

Backend requirements:

- `events`
- `event_hosts`
- `event_rsvps`
- `event_campaigns`
- `event_reminders`
- `event_followups`
- `event_attendance`
- `event_promotions`

APIs:

- `GET /api/v1/events`
- `GET /api/v1/events/{id}`
- `POST /api/v1/provider-portal/events`
- `PATCH /api/v1/provider-portal/events/{id}`
- `POST /api/v1/events/{id}/rsvp`
- `POST /api/v1/events/{id}/promote`
- `GET /api/v1/provider-portal/events/{id}/analytics`

### Pillar E: Marketing Growth Engine

We will heavily leverage the existing marketing automation machine and adapt it to senior services.

Core modules:

- AI Studio.
- AI SEO.
- AI blog/content generation.
- AI social media.
- AI review request campaigns.
- AI review response assistant.
- AI chat.
- AI voice/missed-call assistant.
- Local ranking tracker.
- Campaign builder.
- Provider performance dashboard.
- Landing page builder.
- Event campaign generator.
- Newsletter/push placement manager.

Growth engine must support:

- Provider profile campaigns.
- Event campaigns.
- Local SEO city/category pages.
- Blog/topic cluster campaigns.
- Review generation campaigns.
- Social content calendar.
- App feed/native post campaigns.
- Sponsored content campaigns.
- Voice/chat follow-up.
- Analytics attribution.

Backend requirements:

- `marketing_campaigns`
- `campaign_channels`
- `campaign_creatives`
- `campaign_runs`
- `campaign_tasks`
- `campaign_audiences`
- `campaign_metrics`
- `ai_generations`
- `content_assets`
- `social_posts`
- `seo_pages`
- `review_campaigns`
- `voice_campaigns`
- `chat_agents`

APIs:

- `POST /api/v1/provider-portal/campaigns`
- `GET /api/v1/provider-portal/campaigns`
- `POST /api/v1/provider-portal/campaigns/{id}/generate`
- `POST /api/v1/provider-portal/campaigns/{id}/approve`
- `POST /api/v1/provider-portal/campaigns/{id}/publish`
- `GET /api/v1/provider-portal/campaigns/{id}/metrics`
- `POST /api/v1/webhooks/social/{provider}`
- `POST /api/v1/webhooks/reviews/{provider}`

AI guardrails:

- No unsupported medical claims.
- No fake reviews or fabricated testimonials.
- No fake pricing/availability.
- No unapproved provider claims.
- Sponsored content must disclose sponsorship.
- Generated content must cite source data when using facility/license facts.

### Pillar F: Advertising and Placement Engine

All website and app real estate is advertising opportunity, but trust comes first.

Ad inventory types:

- Search result sponsored listing.
- Provider profile sponsored modules.
- City page sponsorship.
- Category page sponsorship.
- Resource guide sponsorship.
- Blog/native article sponsorship.
- Community feed sponsored post.
- Event feed featured placement.
- Newsletter ad.
- Mobile app feed ad.
- Push notification sponsorship.
- Map pin promotion.
- Comparison page featured option.
- Local expert spotlight.

Ad serving modes:

- Direct-sold campaigns.
- House campaigns.
- Provider plan-included credits.
- Google Ad Manager / AdSense placements.
- Future programmatic native backfill.

Ad compliance requirements:

- All ads must be labeled "Ad", "Advertisement", or "Sponsored" as required by Google native ad guidance.
- Native ads must be visually distinguishable from organic content.
- No camouflaging ads as navigation or community recommendations.
- No clickable white-space ad units.
- Sensitive health or hardship targeting must be restricted.
- Do not use caregiver health/medical hardship data for personalized ad targeting through Google ad products.
- Maintain consent and privacy controls for app/web tracking.

Backend requirements:

- `ad_placements`
- `ad_inventory_slots`
- `ad_campaigns`
- `ad_creatives`
- `ad_targeting_rules`
- `ad_contracts`
- `ad_impressions`
- `ad_clicks`
- `ad_conversions`
- `ad_frequency_caps`
- `ad_moderation_reviews`
- `google_ad_units`
- `google_ad_events`

APIs:

- `GET /api/v1/ads/placements/{key}`
- `POST /api/v1/ads/impression`
- `POST /api/v1/ads/click`
- `POST /api/v1/provider-portal/ad-campaigns`
- `GET /api/v1/provider-portal/ad-campaigns/{id}/metrics`
- `POST /api/v1/admin/ad-placements`
- `POST /api/v1/admin/google-ad-units/sync`

Google Ads/Ad Manager notes:

- Use Google Ad Manager for scalable inventory control where possible.
- Use AdSense only for lower-control backfill surfaces.
- Prefer direct-sold native sponsorships for provider/local expert monetization.
- Avoid placing Google personalized ad tags on flows that infer sensitive health, medical, financial hardship, or crisis-care status unless counsel and policy review approve the implementation.

### Pillar G: Data Aggregation and Inventory Engine

We cannot manually add 20,000+ providers. Inventory must be built through compliant aggregation.

Data source priority:

1. CMS/government data.
2. State licensing data.
3. Provider-owned public websites.
4. Provider-submitted claims.
5. Licensed vendor datasets.

Crawler rules:

- Crawl only public pages.
- Respect robots.txt operationally.
- Do not bypass authentication or technical restrictions.
- Extract factual business data; do not clone copyrighted descriptions.
- Store source URL, fetched timestamp, confidence, and legal/source status for every field.
- Route low-confidence or sensitive changes into human review.

Backend requirements:

- `data_sources`
- `crawl_jobs`
- `crawl_pages`
- `extracted_entities`
- `entity_matches`
- `source_field_values`
- `data_quality_flags`
- `import_batches`
- `legal_source_reviews`

APIs:

- `POST /api/v1/admin/data-sources`
- `POST /api/v1/admin/crawl-jobs`
- `GET /api/v1/admin/crawl-jobs/{id}`
- `POST /api/v1/admin/import-batches/{id}/approve`
- `GET /api/v1/admin/data-quality/queue`

### Pillar H: Reviews and Reputation

Review management is a paid add-on and a trust differentiator.

Consumer features:

- Submit reviews.
- Rate providers.
- Mark reviews helpful.
- Report abuse.
- Verified family/resident labels where possible.

Provider features:

- Review inbox.
- AI response draft.
- Review request campaigns.
- Sentiment analysis.
- Complaint workflow.
- Google Business Profile integration where allowed.
- Public response publishing.

Compliance:

- No fake reviews.
- No review gating.
- No suppressing negative reviews deceptively.
- Follow FTC review/testimonial rules.

Backend requirements:

- `reviews`
- `review_sources`
- `review_requests`
- `review_responses`
- `review_moderation_cases`
- `review_sentiment`
- `reputation_scores`
- `external_review_integrations`

APIs:

- `GET /api/v1/providers/{id}/reviews`
- `POST /api/v1/providers/{id}/reviews`
- `POST /api/v1/reviews/{id}/report`
- `POST /api/v1/provider-portal/review-requests`
- `POST /api/v1/provider-portal/reviews/{id}/responses/generate`
- `POST /api/v1/provider-portal/reviews/{id}/responses/publish`

### Pillar I: AI Newsroom and Publishing Engine

The platform must include an AI-powered newsroom that can run industry content, executive thought leadership, podcasts, interviews, social clips, newsletters, and authority-building campaigns at high velocity.

This engine is not a blind reposting/spinning tool. It must operate as an editorial system with source attribution, originality checks, human approval, legal/copyright guardrails, and publishing analytics.

Strategic goal:

- Make the platform an industry voice in senior care.
- Publish 10-15 high-quality AI-assisted articles per week under approved bylines.
- Turn industry news into commentary, analysis, local explainers, social posts, podcast topics, and provider-facing insights.
- Build authority against APFM through original point of view, interviews, data, and local senior-care expertise.

Allowed content modes:

- Original analysis articles.
- News commentary with short excerpts and links.
- RSS/news roundup with summaries and source links.
- "What this means for families" explainers.
- "What this means for operators" explainers.
- Interview articles.
- Podcast transcripts and show notes.
- Expert Q&A articles.
- Local event recaps.
- Provider education guides.
- Regulatory update explainers.
- Social media thread/post generation.
- Newsletter editions.
- Video/podcast clip scripts.

Restricted content modes:

- Do not republish full third-party articles unless explicit syndication/license permission exists.
- Do not copy competitor guides, reviews, photos, or original descriptions.
- Do not publish AI-generated medical/legal/financial advice without appropriate review/disclaimer.
- Do not fabricate quotes, interviews, statistics, providers, or personal experiences.
- Do not publish under a human byline without a clear internal approval record from that person or delegated editorial owner.

Editorial workflow:

1. Source intake
   - RSS feeds.
   - Google News/manual source URLs.
   - Industry newsletters.
   - CMS/state/regulatory updates.
   - Provider/community submissions.
   - Interview recordings/transcripts.
   - Internal platform data insights.

2. Triage
   - Categorize by audience: families, seniors, providers, local experts, investors, policy/regulation.
   - Score by timeliness, authority potential, SEO value, social value, and monetization tie-in.
   - Detect duplicate topics and source overlap.

3. Draft generation
   - Generate original article structure.
   - Include citations/source links.
   - Add platform point of view.
   - Add "What this means" sections.
   - Generate SEO title/meta/slug/schema.
   - Generate social variants.
   - Generate newsletter variant.
   - Generate podcast/video talking points where relevant.

4. Editorial review
   - Fact check.
   - Copyright/syndication check.
   - Compliance check.
   - Human byline approval.
   - Sponsored/affiliate disclosure check.
   - Medical/legal/financial sensitivity review.

5. Publishing
   - Publish to web.
   - Distribute to app feed.
   - Send to newsletter.
   - Queue social posts.
   - Create provider dashboard content suggestions.
   - Create podcast/video assets.

6. Performance loop
   - Track views, scroll depth, shares, app saves, comments, backlinks, keyword rank movement, newsletter clicks, social engagement, provider conversions, and ad revenue.
   - Feed winners back into topic cluster planning.

Backend requirements:

- `content_sources`
- `rss_feeds`
- `news_items`
- `editorial_topics`
- `article_drafts`
- `published_articles`
- `article_sources`
- `article_reviews`
- `byline_profiles`
- `editorial_approvals`
- `content_compliance_checks`
- `content_distribution_jobs`
- `podcast_episodes`
- `interview_guests`
- `interview_transcripts`
- `social_content_variants`
- `newsletter_editions`
- `content_performance_metrics`
- `content_rights_licenses`

APIs:

- `POST /api/v1/admin/content-sources`
- `POST /api/v1/admin/rss-feeds`
- `POST /api/v1/admin/newsroom/intake`
- `GET /api/v1/admin/newsroom/inbox`
- `POST /api/v1/admin/newsroom/topics/{id}/generate-draft`
- `POST /api/v1/admin/newsroom/articles/{id}/compliance-check`
- `POST /api/v1/admin/newsroom/articles/{id}/approve`
- `POST /api/v1/admin/newsroom/articles/{id}/publish`
- `POST /api/v1/admin/newsroom/articles/{id}/generate-social`
- `POST /api/v1/admin/newsroom/articles/{id}/generate-podcast-brief`
- `GET /api/v1/articles`
- `GET /api/v1/articles/{slug}`
- `GET /api/v1/newsletters/{id}`
- `POST /api/v1/podcasts/{id}/publish`

AI newsroom agents:

- Source Monitor Agent: watches RSS/news/regulatory sources and deduplicates stories.
- Assignment Editor Agent: chooses what deserves coverage and assigns angle/audience.
- Research Agent: collects facts, sources, quotes, and related platform data.
- Drafting Agent: writes article drafts in the approved editorial voice.
- SEO Editor Agent: creates titles, meta, schema, internal links, and topic cluster links.
- Compliance Editor Agent: flags copyright, health, legal, financial, endorsement, sponsored, and AI-disclosure risks.
- Social Producer Agent: creates LinkedIn, Facebook, X, Instagram, short-video captions, and app-feed posts.
- Podcast Producer Agent: creates episode briefs, interview questions, intros, outros, clips, and show notes.
- Newsletter Editor Agent: assembles weekly/daily newsletter editions.
- Performance Analyst Agent: identifies winning topics and recommends follow-up content.

Human control:

- Articles under the founder/operator byline require explicit approval before publication.
- Interview content requires guest release/approval workflow where needed.
- Sponsored articles require visible sponsorship disclosure.
- AI-assisted content should include process disclosure where reasonably expected.

SEO/content quality requirements:

- Every article must have a clear audience and useful purpose.
- Every article must add original analysis, local context, expert input, or platform data.
- Every article must link to sources and related platform pages.
- Avoid thin scaled content.
- Avoid generic AI summaries with no unique point of view.
- High-impact health, safety, legal, or financial content must be reviewed or labeled appropriately.

### Pillar J: Policy Guardrail and Governance Engine

The platform must include a mandatory policy enforcement system that even admins/founders cannot bypass in normal workflows. This is a first-class product feature, not an internal note.

Principle:

- Speed is allowed.
- Automation is allowed.
- Aggressive marketing is allowed.
- Publishing is allowed.
- But every externally visible output must pass policy, provenance, disclosure, and audit checks before release.

Protected actions:

- Article publishing.
- RSS/news commentary publishing.
- Podcast publishing.
- Interview publishing.
- Social media publishing.
- Newsletter sending.
- App push notifications.
- SMS/email campaigns.
- AI review responses.
- Provider ad campaigns.
- Sponsored/native placements.
- Event promotions.
- Community posts by providers/experts.
- Provider profile claims and edits.
- AI chat/voice knowledge updates.
- Third-party API writes.
- Data source imports.
- Web crawler activation.

Policy gates:

1. Copyright and source rights
   - Blocks full third-party article republication without license.
   - Requires source links for commentary/news-derived content.
   - Flags copied descriptions, reviews, photos, and competitor content.

2. Sponsorship and ad disclosure
   - Requires visible "Sponsored", "Ad", or equivalent label for paid placements.
   - Blocks native ads that visually hide commercial intent.
   - Requires FTC-style material connection disclosures.

3. Health, legal, financial, and senior-care sensitivity
   - Flags medical, care-safety, legal, insurance, Medicaid/Medicare, and financial claims.
   - Requires disclaimers or expert/legal review where appropriate.
   - Blocks unsupported claims such as guaranteed outcomes, medical advice, or unverifiable quality assertions.

4. Review and testimonial integrity
   - Blocks fake reviews/testimonials.
   - Blocks review gating.
   - Requires disclosure for incentivized reviews or endorsements.
   - Prevents AI from fabricating consumer experiences.

5. Consent and outreach
   - Blocks SMS/call/email/push campaigns without recorded consent and opt-out path.
   - Enforces TCPA/CAN-SPAM-style contact rules.
   - Enforces user notification preferences.

6. Ad targeting and sensitive data
   - Blocks personalized ad targeting based on sensitive health/care hardship signals.
   - Separates contextual targeting from sensitive audience targeting.
   - Prevents exporting sensitive caregiver/senior segments to ad platforms without approval.

7. Data sourcing and crawling
   - Requires source registration before crawling/import.
   - Requires robots/terms review status.
   - Blocks gated/authenticated scraping.
   - Requires provenance for every imported field.

8. AI byline and identity
   - Blocks publishing under a human byline without approval.
   - Requires internal record of AI assistance.
   - Requires AI/process disclosure where reasonably expected.

9. Community safety
   - Blocks scams, predatory offers, harassment, discriminatory content, and unsafe medical claims.
   - Routes reports to moderation.
   - Applies stricter rules to seniors and vulnerable-adult contexts.

10. Admin override controls
   - Normal admins cannot bypass hard policy blocks.
   - Emergency override requires two-person approval, reason code, legal/compliance category, and immutable audit log.
   - Some blocks are non-overridable by product policy, such as fake reviews, undisclosed paid ads, and unlicensed full-article republication.

Policy decision states:

- `approved`
- `approved_with_disclosure`
- `needs_human_review`
- `needs_legal_review`
- `needs_expert_review`
- `blocked`
- `blocked_non_overridable`

Backend requirements:

- `policy_rules`
- `policy_rule_versions`
- `policy_checks`
- `policy_check_items`
- `policy_decisions`
- `policy_overrides`
- `policy_approval_requests`
- `policy_approval_steps`
- `policy_disclosures`
- `content_fingerprints`
- `source_rights_records`
- `consent_records`
- `sensitive_data_flags`
- `audit_events`

APIs:

- `POST /api/v1/policy/check`
- `GET /api/v1/policy/checks/{id}`
- `POST /api/v1/policy/checks/{id}/approve`
- `POST /api/v1/policy/checks/{id}/request-legal-review`
- `POST /api/v1/policy/checks/{id}/override`
- `GET /api/v1/admin/policy/queue`
- `POST /api/v1/admin/policy/rules`
- `PATCH /api/v1/admin/policy/rules/{id}`
- `GET /api/v1/admin/policy/audit`

Required integration pattern:

- Publishing endpoints must call policy checks before publication.
- Campaign send endpoints must call policy and consent checks before send.
- Ad activation endpoints must call policy checks before serving.
- AI generation endpoints must store source inputs and generated output.
- Crawler jobs must call source policy before fetch.
- Provider profile edits must call quality/policy checks before public display when claims are safety-sensitive.

Hard acceptance criteria:

- No externally visible AI-generated article can publish without a policy check record.
- No sponsored placement can render without an associated disclosure label.
- No SMS/push/email campaign can send without consent verification.
- No provider review response can publish without review integrity checks.
- No crawler job can start unless the source is registered and approved.
- No founder/admin fast path may skip audit logging.

This feature exists to protect the company, users, providers, and the brand. It should be visible in the admin UX as the "Policy Gate" or "Trust Center" so operators understand that the platform is built for speed with discipline.

## 7. Open API Platform

The platform must expose open APIs for approved third-party integrations.

Integration users:

- Providers with websites/CRMs.
- Local senior centers.
- Agency partners.
- Mobile/web partners.
- Data partners.
- Event partners.
- Advertising partners.

API principles:

- OAuth2 or signed API keys.
- Tenant/provider scoped access.
- Rate limits.
- Webhooks.
- Audit logs.
- Versioned endpoints.
- Developer docs.
- Sandbox mode.

Open API modules:

- Provider directory API.
- Events API.
- Reviews API.
- Campaign API.
- Community API.
- Ads/placements API.
- Data correction/claim API.
- Webhooks for RSVP, contact, review, campaign, ad click, and profile update events.

Required webhook events:

- `provider.claimed`
- `provider.updated`
- `provider.contact.created`
- `review.created`
- `review.response.published`
- `event.created`
- `event.rsvp.created`
- `campaign.published`
- `campaign.metric.updated`
- `ad.impression.recorded`
- `ad.click.recorded`
- `community.post.created`

## 8. Search, SEO, and Authority Requirements

SEO is a primary acquisition channel.

Page types:

- State pages.
- City pages.
- Neighborhood pages.
- Care type pages.
- Provider profile pages.
- Event pages.
- Expert profile pages.
- Resource guides.
- Cost guides.
- Comparison pages.
- Review pages.

Each SEO page must include:

- Real listings or real source data.
- Unique local copy.
- Structured data/schema.
- Internal links.
- Source freshness.
- Clear ad/sponsor labels.
- FAQ content.
- Mobile performance.
- Conversion paths to app, saved providers, events, and contact.

Authority engine:

- Expert-reviewed guides.
- Local expert Q&A.
- Original data summaries.
- Event recaps.
- Provider education content.
- Community answers.
- Review/reputation insights.

## 9. Ranking and Recommendation Rules

Organic ranking must be separate from sponsored placement.

Organic ranking inputs:

- Category match.
- Distance.
- Care/service fit.
- License/verification status.
- Availability.
- Reviews and reputation.
- Data freshness.
- Consumer preferences.
- Safety/licensing signals where available.

Paid placement rules:

- Paid boosts can create sponsored modules or clearly labeled promoted slots.
- Paid status must not silently override organic recommendations.
- A user must be able to distinguish organic and sponsored results.

## 10. Analytics Requirements

Consumer analytics:

- Search queries.
- Listing views.
- Saves.
- Compares.
- Contacts.
- Event RSVPs.
- App installs.
- App engagement.
- Review submissions.

Provider analytics:

- Profile views.
- Contact actions.
- Chat conversations.
- Event views/RSVPs.
- Campaign reach.
- Social/post engagement.
- Review requests sent.
- Reviews received.
- Ad impressions/clicks.
- SEO page traffic.
- Local ranking signals.

Admin analytics:

- Inventory growth.
- Crawl quality.
- Data freshness.
- Moderation queue health.
- Revenue by product.
- Ad fill rate.
- Google ad revenue.
- Direct-sold campaign revenue.
- Churn/renewal risk.

## 11. Compliance Requirements

This product touches seniors, care decisions, health-adjacent needs, advertising, reviews, and automated outreach.

Required compliance surfaces:

- Privacy policy.
- Terms of service.
- Community guidelines.
- Provider terms.
- Advertising policy.
- Sponsored content policy.
- Review policy.
- Data source/crawler policy.
- Consent management.
- Call/text/email opt-in and opt-out.
- State referral law review, even though we do not monetize referrals.
- Google publisher policy review for ad units.
- FTC review/testimonial compliance.

Important:

- Not monetizing referrals reduces conflict-of-interest risk, but does not remove disclosure obligations if the platform recommends, ranks, advertises, or transfers consumer information to providers.
- Legal counsel should review state-by-state senior referral rules before launch in each state.

## 12. MVP Release Scope

### MVP 1: Directory + Provider Profiles

- Provider search.
- Provider profile.
- Free contact.
- Claim listing.
- Admin data import.
- Source provenance.
- Sponsored label framework.

### MVP 2: Events + Community

- Local event listing.
- RSVP flow.
- Community feed.
- Provider posts.
- Moderation.
- Event promotion products.

### MVP 3: Marketing Growth Engine

- Provider dashboard.
- AI campaign builder.
- AI social.
- AI SEO/blog.
- Review request campaigns.
- Campaign analytics.

### MVP 4: Mobile App

- Search.
- Save/compare.
- Community feed.
- Events.
- Chat.
- Push preferences.
- Care circle sharing.

### MVP 5: Ads + Open APIs

- Placement engine.
- Direct-sold campaign manager.
- Google Ad Manager/AdSense integration.
- Public API keys.
- Webhooks.
- Developer docs.

## 13. Acceptance Criteria

A feature is accepted only when:

- UI works on desktop and mobile/app where applicable.
- Backend endpoint exists and is tested.
- Data persists.
- Business rules are enforced.
- Errors are user-visible and logged.
- Audit/analytics events are created.
- Sponsored/paid content labels render correctly.
- API surface is documented if third-party integration is relevant.
- Smoke test or route test verifies the full path.

## 14. Immediate Build Priorities

1. Create canonical provider data model.
2. Build source registry and import pipeline.
3. Build provider profile and search API.
4. Build free listing claim flow.
5. Build event object and RSVP flow.
6. Build ad placement object from day one.
7. Wire marketing growth campaigns to providers/events/profiles.
8. Define mobile app feed API early so web and app share the same community/event objects.

## 15. Reference Sources

- Product research memo: `docs/senior-care-marketplace-research.md`
- A Place for Mom service model: https://www.aplaceformom.com/eldercare-advisors
- Seniors Blue Book reference model: https://seniorsbluebook.com/
- FTC review/testimonial guidance: https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews
- Google Publisher Policies: https://support.google.com/admanager/answer/10502938
- Google native ads attribution guidance: https://support.google.com/admanager/answer/6366845
- Google personalized advertising sensitive-interest rules: https://support.google.com/publisherpolicies/answer/15101728
