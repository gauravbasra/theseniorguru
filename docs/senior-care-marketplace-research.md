# Senior Care Marketplace Research and Build Playbook

Date: 2026-05-10

## Executive Thesis

Yes, we can build this, but the winning version should not be "another scraped directory." A Place for Mom wins because it combines search dominance, emotional lead capture, advisor follow-up, provider monetization, and a huge paid-provider inventory. To beat it, we need to become more trustworthy and more complete: transparent referral economics, official licensing and inspection data, better local SEO, lower-pressure caregiver UX, and a compliant inventory engine that starts with government/public datasets before crawling provider websites.

The wedge is simple: APFM is strong at converting families in crisis. It is weaker at proving that recommendations are complete, unbiased, and safety-aware. Our product should be the "transparent senior care search layer": all known options in a geography, licensing/inspection context where available, clear labels for paid partners, and advisor help that does not hide non-paying providers.

## Reference Sites

- A Place for Mom: national referral marketplace, strong advisor funnel, large partner network, free-to-family model.
- Seniors Blue Book: local resource guide, print + local publisher trust, broad category directory across senior services.

## Why A Place for Mom Wins

1. Search intent capture
   - They own high-value crisis keywords: "assisted living near me," "memory care near me," "cost of assisted living," city/category pages, and comparison content.
   - Their pages are built for urgent caregivers: phone number, form, advisor promise, low-friction CTA, social proof.

2. Free-to-family monetization
   - APFM discloses that families do not pay; participating communities/home care agencies pay when a family moves in or signs up.
   - This removes purchase friction for the caregiver and shifts acquisition cost to providers.

3. Human advisor layer
   - Senior care is emotionally loaded, confusing, and expensive. A directory alone is not enough.
   - APFM turns search traffic into phone-assisted matching, tour scheduling, and follow-up.

4. Provider network effects
   - Providers pay because APFM sends high-intent leads.
   - Families use APFM because it has many providers and fast human help.
   - This compounds into SEO, reviews, partner referrals, and ad efficiency.

5. Trust and review footprint
   - APFM has thousands of reviews across third-party review sites, generally positive, although complaints often mention aggressive follow-up or referral pressure.

6. Partnerships and distribution
   - They appear through partner channels, not just their own site. Walgreens, for example, has a partner page explaining APFM's process and free-to-family model.

## APFM Vulnerabilities

1. Perceived conflict of interest
   - APFM is paid by participating providers. Families may assume recommendations include all local options, but paid-network marketplaces often do not.
   - Their own support/review policy frames the service around "Participating Communities."

2. Safety transparency gap
   - The Washington Post reported in 2024 that APFM did not independently assess records in the way many consumers might expect, and that some highly recommended facilities had recent neglect/substandard-care citations.

3. High-pressure contact complaints
   - Third-party reviews are broadly positive, but a recurring negative pattern is too many calls, texts, and emails after inquiry.

4. Limited "complete market" promise
   - If only paying providers can be recommended, we can win by showing both paid and unpaid options, clearly labeled.

5. Local trust opportunity
   - Seniors Blue Book has local publisher/community trust and print distribution. APFM has national scale. A hybrid can beat both: national data engine + local expert pages + transparent local resource guides.

## How We Beat Them

1. Build the most complete inventory, not just the most monetizable one
   - Include licensed facilities, CMS nursing homes, assisted living, memory care, home care, hospice, adult day care, elder law, estate planning, transportation, meal delivery, medical alert, downsizing, and caregiver support.
   - Label monetization honestly: "Verified partner," "Public listing," "Claimed listing," "Sponsored placement."

2. Use official data as the trust backbone
   - CMS Care Compare / Provider Data Catalog for Medicare-certified nursing homes, SNFs, home health, hospice, hospitals, penalties, inspections, quality measures.
   - State licensing datasets for assisted living/memory care/adult family homes where available.
   - Provider websites for amenities, photos, pricing language, care types, phone, address, and service descriptions.

3. Create safety-aware profiles
   - Show licensing status, inspection/deficiency summaries, ownership, bed count, CMS star ratings where applicable, and data freshness.
   - Do not overstate ratings for assisted living if the state does not provide comparable quality metrics.

4. Win long-tail SEO
   - Generate high-quality city/category pages: "Assisted Living in Mesa, AZ," "Memory Care in Plano, TX," "Adult Family Homes in Bellevue, WA."
   - Each page must include unique local data, pricing ranges, licensing notes, inspection context, FAQs, and actual listings.
   - Avoid thin auto-generated doorway pages.

5. Build a better caregiver intake
   - Needs assessment: care level, diagnosis, mobility, budget, payer type, location radius, urgency, pets, language, religious/cultural preferences.
   - Give results immediately before forcing a phone call.
   - Let users control contact cadence: phone, text, email, no calls.

6. Provider self-serve portal
   - Claim listing, correct data, upload photos, add current availability, update pricing ranges, request verified badge.
   - Keep audit history so user-submitted edits do not overwrite official data silently.

7. Advisor model with compliance baked in
   - Advisors can help, but every referral flow must display required disclosures before referral.
   - Recommendations should consider consumer preferences and not use commission as the sole ranking factor.

## Compliant Data Aggregation Playbook

This is not legal advice; we should have counsel review before launch, especially state-by-state referral requirements.

### Preferred Data Sources

1. Government/open datasets
   - CMS Provider Data Catalog and Care Compare for nursing homes/SNFs, home health, hospice, quality, staffing, deficiencies, penalties.
   - State licensing databases for assisted living, memory care, adult family homes, residential care, home care agencies.
   - County/city business licensing where relevant.

2. Provider-owned public websites
   - Crawl only public pages at respectful rates.
   - Respect robots.txt and terms where applicable.
   - Extract factual business data: name, address, phone, services, amenities, images only when license allows, pricing text, contact URLs.

3. Provider submissions
   - Let businesses claim and update profiles.
   - Require attestation that submitted data is accurate and that they have rights to uploaded media.

4. Third-party data vendors/APIs
   - Use where licensing is clean and economics work.

### Avoid or Restrict

- Do not scrape gated sites, logged-in dashboards, private directories, or pages that require bypassing technical controls.
- Do not copy competitor reviews wholesale.
- Do not copy copyrighted descriptions verbatim except short factual snippets where legally reviewed.
- Do not use scraped personal data for unsolicited marketing without consent and TCPA/CAN-SPAM review.
- Do not imply medical advice or quality ratings beyond what the source supports.

### Legal and Compliance Areas

1. Web scraping law
   - Public web scraping may avoid CFAA issues under cases like hiQ v. LinkedIn in the Ninth Circuit, but contract, trespass, copyright, privacy, and cease-and-desist risks remain.
   - Treat robots.txt as an operational rule even if not always independently binding.

2. Copyright
   - Facts are generally not copyrightable; original descriptions, photos, reviews, and page layouts are.
   - Store facts and source URLs. Generate our own summaries. Do not clone copy.

3. Privacy
   - Facility data is business data, but caregiver lead data is sensitive.
   - Need privacy policy, consent logs, opt-out/delete flows, data minimization, encryption, and role-based access.

4. Referral agency laws
   - States can regulate senior referral agencies. Washington RCW 18.330 requires disclosures, intake, provider information, recordkeeping, and other obligations.
   - Texas added required senior living referral disclosures in 2025.
   - Arizona requires disclosure of business relationships and referral fees for assisted living referrals.

5. FTC reviews/testimonials
   - Do not fake reviews, suppress negative reviews deceptively, buy undisclosed endorsements, or display testimonials without proper disclosure.

6. TCPA/CAN-SPAM/contact consent
   - Calls/texts require careful consent capture and opt-out.
   - This is a major APFM complaint area, so we should use it as a trust differentiator.

7. Healthcare/HIPAA
   - We should avoid collecting clinical records unless necessary.
   - HIPAA may apply only in specific covered-entity/business-associate contexts, but we should still treat care needs as sensitive health-adjacent data.

## Data Engine Architecture

1. Source registry
   - Tables for data sources, source type, URL/API endpoint, license/terms, robots status, crawl cadence, jurisdiction, and legal approval status.

2. Ingestion workers
   - API loaders for CMS and state datasets.
   - Web crawlers for provider-owned sites.
   - Sitemap discovery and structured data extraction using schema.org LocalBusiness, AssistedLiving, NursingHome where present.

3. Extraction pipeline
   - HTML fetch -> readability/content extraction -> entity extraction -> address/phone normalization -> geocoding -> category classification -> confidence score.

4. Entity resolution
   - Match on normalized name, address, phone, license ID, CMS Certification Number, domain.
   - Keep source-level records separate from canonical facility records.

5. Human review queue
   - Flag low-confidence matches, conflicting phone/address, closed facilities, safety-sensitive claims, and duplicate entities.

6. Freshness and provenance
   - Every field stores source, source URL, fetched_at, confidence, and whether it is official, provider-submitted, or inferred.

7. Ranking engine
   - Separate "organic relevance" from "sponsored/partner boost."
   - Ranking inputs: care fit, distance, availability, budget fit, license status, safety signals, user preferences, review quality, freshness.
   - Disclose sponsored listings.

8. Claim/verification portal
   - Providers can submit corrections.
   - Corrections go to moderation or merge logic depending on risk.

## MVP Build Sequence

Phase 1: Data foundation
- Load CMS nursing home/SNF datasets nationally.
- Add 2-3 state licensing sources for assisted living/memory care.
- Build canonical facility model and search.

Phase 2: Public website enrichment
- Crawler for provider websites with robots/terms checks.
- Extract amenities, care types, descriptions, photos metadata, phone, emails, contact forms.

Phase 3: Consumer product
- Search by city/care type.
- Facility profile pages.
- Comparison tool.
- Transparent disclosure labels.
- Intake form with contact controls.

Phase 4: Provider portal
- Claim listing.
- Edit profile.
- Upload media.
- Add availability.
- Partner lead dashboard.

Phase 5: Advisor/CRM
- Lead routing.
- Consent tracking.
- Referral disclosure workflow.
- Tour scheduling.
- Outcome tracking.

## Sources

- A Place for Mom, "How Our Service Works": https://www.aplaceformom.com/eldercare-advisors
- A Place for Mom, Contact / provider network language: https://www.aplaceformom.com/contact
- A Place for Mom support review policy: https://support.aplaceformom.com/docs/review-policy
- Seniors Blue Book home/about resource guide language: https://seniorsbluebook.com/
- Seniors Blue Book advertising/community authority article: https://seniorsbluebook.com/articles/more-than-a-directory-how-seniors-blue-book-helps-you-build-community-and-brand-authority
- CMS Nursing Home Quality Initiative: https://www.cms.gov/medicare/quality/nursing-home-improvement
- FTC Endorsements, Influencers, and Reviews guidance: https://www.ftc.gov/business-guidance/advertising-marketing/endorsements-influencers-reviews
- FTC Consumer Reviews and Testimonials Rule Q&A: https://www.ftc.gov/business-guidance/resources/consumer-reviews-testimonials-rule-questions-answers
- Washington Elder and Vulnerable Adult Referral Agency Act overview: https://asrpwa.org/posts/elder-and-vulnerable-adult-referral-agency-act
- Texas referral agency disclosure statute: https://law.justia.com/codes/texas/business-commerce-code/title-5/subtitle-c/chapter-121/section-121-002/
- Arizona assisted living referral agency disclosure statute summary: https://codes.findlaw.com/az/title-36-public-health-and-safety/az-rev-st-sect-36-446-14.html/
- Washington Post investigation on APFM safety transparency: https://www.washingtonpost.com/business/2024/05/16/place-for-mom-assisted-living-referral/
- Trustpilot APFM review summary: https://www.trustpilot.com/review/www.aplaceformom.com
- Sitejabber APFM review summary: https://www.sitejabber.com/reviews/aplaceformom.com
- Walgreens APFM partner page: https://www.walgreens.com/findcare/partner/aplaceformom
