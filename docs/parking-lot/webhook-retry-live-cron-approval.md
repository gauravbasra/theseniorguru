# Webhook Retry Live Cron Approval

## Parked Owner Decisions

- Confirm partner webhook endpoints, signing secrets, and retry policies are ready for live retry delivery.
- Set `WEBHOOK_RETRY_CRON_MODE=live` only after final owner approval.
- Set `WEBHOOK_RETRY_CRON_LIVE_APPROVED=true`, `WEBHOOK_RETRY_CRON_APPROVED_BY`, and `WEBHOOK_RETRY_CRON_APPROVED_AT` together so the cron route has auditable approval metadata.
- Review the first live worker run for failed candidates, blocked candidates, requeued counts, delivery failures, and blocked delivery totals before scaling cadence.

## Current Implementation State

- Preview mode remains the default and runs non-mutating webhook retry candidate checks.
- If live mode is enabled without approval metadata, `GET /api/cron/webhooks` records a failed scheduled-worker run with the exact missing gates and returns `424`.
- Approved live mode runs the existing webhook retry scheduler and delivery executor with the configured `WEBHOOK_RETRY_CRON_LIMIT`.
