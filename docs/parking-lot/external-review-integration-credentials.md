# External Review Integration Credentials

Owner action is required before live external review sync can be enabled.

## Blockers

- Google Business Profile read-only review API access must be approved by each provider/operator.
- Facebook review/page access must use provider-owned OAuth approval.
- Caring.com and A Place for Mom exports require source-specific partner approval or manual export cadence.
- Credential references must be stored as provider-owned credential records, not platform `.env` secrets.

## Safe Current State

- The application can record integration readiness, source status, blockers, and credential-reference evidence.
- Live sync remains blocked until provider-owned credentials and owner approval are installed.
