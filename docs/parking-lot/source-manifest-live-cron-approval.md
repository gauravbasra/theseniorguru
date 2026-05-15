# Source Manifest Live Cron Approval

## Parked Owner Decisions

- Confirm which source-object manifests are approved for unattended live fetches.
- Confirm production object storage credentials and signed URL policy before enabling live fetches.
- Set `SOURCE_MANIFEST_FETCH_CRON_MODE=live` only after final owner approval.
- Set `SOURCE_MANIFEST_FETCH_CRON_LIVE_APPROVED=true`, `SOURCE_MANIFEST_FETCH_CRON_APPROVED_BY`, and `SOURCE_MANIFEST_FETCH_CRON_APPROVED_AT` together so the cron route has auditable approval metadata.
- Review the first live worker run for fetched record counts, checksum outcomes, rejected records, and staged entity quality before scaling cadence.

## Current Implementation State

- Preview mode remains the default and runs non-mutating source-manifest fetch readiness checks.
- If live mode is enabled without approval metadata, `GET /api/cron/source-manifests` records a failed scheduled-worker run with the exact missing gates and returns `424`.
- Approved live mode runs the existing source adapter manifest fetch worker against fetch-ready manifests only.
