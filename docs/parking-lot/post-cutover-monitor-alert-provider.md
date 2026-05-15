# Post-Cutover Monitor Alert Provider Activation

## Owner Dependency

Live queue-backed post-cutover monitor alert delivery is parked until the owner approves the internal notification queue provider and installs the production endpoint.

## Current Safe Path

- Use `GET /api/v1/system/post-cutover-monitor-alerts` to preview alert payloads and delivery readiness.
- Use `POST /api/v1/system/post-cutover-monitor-alerts` with `deliveryProvider: "manual_export"` and `dryRun: false` to archive launch-ops alert evidence without sending secrets or external notifications.
- Keep `deliveryProvider: "internal_notification_queue"` in dry-run mode until the queue target is approved.

## Required Owner Inputs

- Approved HTTPS endpoint for `INTERNAL_NOTIFICATION_QUEUE_URL`.
- Optional bearer token for `INTERNAL_NOTIFICATION_QUEUE_TOKEN`.
- Optional queue topic for `INTERNAL_NOTIFICATION_QUEUE_TOPIC`.
- Confirmation that post-cutover monitor payloads may be sent to the provider.

## Activation Gate

Do not enable live queue dispatch until the endpoint is HTTPS, the owner confirms notification routing, and a dry-run payload review is archived.
