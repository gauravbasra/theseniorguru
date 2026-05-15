# Import Escalation Retry Live Cron Approval

## Parked Owner Decisions

- Confirm import escalation retry scheduling may run live against overdue or failed escalation records.
- Confirm whether live retry delivery should remain `manual_export` or use `internal_notification_queue` after queue provider approval.
- Set `IMPORT_ESCALATION_RETRY_CRON_MODE=live` only after final owner approval.
- Set `IMPORT_ESCALATION_RETRY_CRON_LIVE_APPROVED=true`, `IMPORT_ESCALATION_RETRY_CRON_APPROVED_BY`, and `IMPORT_ESCALATION_RETRY_CRON_APPROVED_AT` together so the cron route has auditable approval metadata.
- Review the first live worker run for scheduler candidates, retries scheduled, delivery batches, executed deliveries, and delivery blockers before increasing cadence.

## Current Implementation State

- Preview mode remains the default and runs non-mutating retry candidate checks plus delivery previews.
- If live mode is enabled without approval metadata, `GET /api/cron/import-escalation-retries` records a failed scheduled-worker run with the exact missing gates and returns `424`.
- Approved live mode runs the existing retry scheduler and delivery executor with the configured `IMPORT_ESCALATION_RETRY_CRON_LIMIT` and delivery provider.
