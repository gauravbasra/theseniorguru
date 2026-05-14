# Scheduled Worker Live Alert Provider

## Status

Owner approval and provider configuration required before live internal notification queue delivery is enabled.

## Why this is parked

Scheduled-worker alert delivery now supports preview and manual-export dispatch evidence. Live delivery to an internal notification queue is intentionally blocked until the owner confirms the alert provider, recipient routing, escalation policy, and queue credentials.

## Current safe path

- Use `/api/v1/admin/scheduled-worker-alerts` with `dryRun: true` to preview cron health alert payloads.
- Use `/api/v1/admin/scheduled-worker-alerts` with `dryRun: false` and `deliveryProvider: "manual_export"` to record launch-ops follow-up evidence.
- Keep `internal_notification_queue` blocked until provider activation is approved.
