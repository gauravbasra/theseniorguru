# Source Acquisition Live Cron Approval

## Parked Owner Decisions

- Confirm current-site acquisition may stage live records on the production cadence.
- Confirm the maximum record count for each scheduled live run.
- Set `SOURCE_ACQUISITION_CRON_MODE=live` only after final owner approval.
- Set `SOURCE_ACQUISITION_CRON_LIVE_APPROVED=true`, `SOURCE_ACQUISITION_CRON_APPROVED_BY`, and `SOURCE_ACQUISITION_CRON_APPROVED_AT` together so the cron route has auditable approval metadata.
- Review the first live worker run for discovered listings, staged records, rejected records, source policies, and quality gaps before increasing cadence or record limits.

## Current Implementation State

- Preview mode remains the default and runs non-mutating current-site acquisition previews.
- If live mode is enabled without approval metadata, `GET /api/cron/acquisition` records a failed scheduled-worker run with the exact missing gates and returns `424`.
- Approved live mode runs the existing current-site acquisition worker with the configured `SOURCE_ACQUISITION_CRON_MAX_RECORDS` limit.
