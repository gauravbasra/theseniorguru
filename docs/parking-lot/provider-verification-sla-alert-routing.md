# Provider Verification SLA Alert Routing

## Owner-Dependent Items

- Confirm which launch-ops inbox, chat channel, or incident workflow should consume queued claim verification SLA alerts after cutover.
- Keep using the audit-backed internal queue evidence until the owner approves external notification routing.

## Implemented Guardrail

- `POST /api/v1/admin/provider-verification-sla/notify` now accepts `deliveryProvider: "internal_notification_queue"` with `dryRun: false` and records a queue delivery attempt in `audit_events`.
