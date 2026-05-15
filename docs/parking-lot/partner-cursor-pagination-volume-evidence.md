# Partner Cursor Pagination Volume Evidence

## Status

Cursor pagination implementation is parked until production volume evidence shows page/pageSize traversal is no longer enough for partner sync workflows.

## Current safe path

- Use `/api/v1/partner/response-pagination` for the active page/pageSize contract.
- Use `/api/v1/partner/pagination-evaluation` for cursor candidates, ordering keys, and migration gates.
- Use `/api/v1/partner/pagination-volume-evidence` and `/api/v1/partner/pagination-volume-evidence?format=csv` to capture production row counts, partner sync cadence, and observed page-depth evidence before implementation.

## Required owner inputs

Set only owner-approved production evidence values for the relevant partner endpoints:

- `PARTNER_PROVIDERS_ROWS`, `PARTNER_PROVIDERS_DAILY_SYNCS`, `PARTNER_PROVIDERS_MAX_PAGE_DEPTH`
- `PARTNER_EVENTS_ROWS`, `PARTNER_EVENTS_DAILY_SYNCS`, `PARTNER_EVENTS_MAX_PAGE_DEPTH`
- `PARTNER_REVIEWS_ROWS`, `PARTNER_REVIEWS_DAILY_SYNCS`, `PARTNER_REVIEWS_MAX_PAGE_DEPTH`
- `PARTNER_COMMUNITY_POSTS_ROWS`, `PARTNER_COMMUNITY_POSTS_DAILY_SYNCS`, `PARTNER_COMMUNITY_POSTS_MAX_PAGE_DEPTH`
- `PARTNER_NEWSROOM_ARTICLES_ROWS`, `PARTNER_NEWSROOM_ARTICLES_DAILY_SYNCS`, `PARTNER_NEWSROOM_ARTICLES_MAX_PAGE_DEPTH`
- `PARTNER_NEWSROOM_NEWSLETTERS_ROWS`, `PARTNER_NEWSROOM_NEWSLETTERS_DAILY_SYNCS`, `PARTNER_NEWSROOM_NEWSLETTERS_MAX_PAGE_DEPTH`
- `PARTNER_NEWSROOM_SOURCES_ROWS`, `PARTNER_NEWSROOM_SOURCES_DAILY_SYNCS`, `PARTNER_NEWSROOM_SOURCES_MAX_PAGE_DEPTH`
- `PARTNER_ADS_PLACEMENTS_ROWS`, `PARTNER_ADS_PLACEMENTS_DAILY_SYNCS`, `PARTNER_ADS_PLACEMENTS_MAX_PAGE_DEPTH`
- `PARTNER_CAMPAIGNS_ROWS`, `PARTNER_CAMPAIGNS_DAILY_SYNCS`, `PARTNER_CAMPAIGNS_MAX_PAGE_DEPTH`

Do not remove page/pageSize when cursor parameters are introduced; cursor support must be additive under the current partner response envelope.
