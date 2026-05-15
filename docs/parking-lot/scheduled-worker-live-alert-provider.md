# Scheduled Worker Live Alert Provider

## Status

Owner approval and provider configuration required before live internal notification queue delivery is enabled.

## Why this is parked

Scheduled-worker alert delivery now supports preview and manual-export dispatch evidence. Live delivery to an internal notification queue is intentionally blocked until the owner confirms the alert provider, recipient routing, escalation policy, and queue credentials.

## Current safe path

- Use `/api/v1/admin/scheduled-worker-alerts` with `dryRun: true` to preview cron health alert payloads.
- Use `/api/v1/admin/scheduled-worker-alerts` with `dryRun: false` and `deliveryProvider: "manual_export"` to record launch-ops follow-up evidence.
- Keep `internal_notification_queue` blocked until provider activation is approved.
- Use `/api/v1/admin/internal-notification-queue/readiness` and `/api/v1/admin/internal-notification-queue/readiness?format=csv` as the shared readiness evidence before activating `internal_notification_queue` across scheduled worker alerts, import escalations, post-cutover monitor alerts, claim SLA alerts, event/community/review workflows, care-circle invites, or voice-assistant handoffs.

## Required activation values

- `INTERNAL_NOTIFICATION_QUEUE_URL`: HTTPS queue endpoint approved for production notification payloads.
- `INTERNAL_NOTIFICATION_QUEUE_APPROVED`: set to `true` only after owner approval.
- `INTERNAL_NOTIFICATION_QUEUE_APPROVED_BY`: owner or operator approving live queue dispatch.
- `INTERNAL_NOTIFICATION_QUEUE_APPROVED_AT`: ISO timestamp for the approval decision.
- `INTERNAL_NOTIFICATION_QUEUE_TOKEN`: optional bearer token if the endpoint requires authenticated dispatch.
- `INTERNAL_NOTIFICATION_QUEUE_TOPIC`: optional route/topic header for queue routing.
