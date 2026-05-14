# Import Escalation Provider Integration

Status: owner-dependent

The import escalation notification workflow now supports manual export delivery and an HTTPS internal notification queue adapter through `/api/v1/admin/extracted-entities/escalations/notify`.

Owner decisions needed before live non-manual dispatch:

- Approve the live escalation provider: internal notification queue, email, Slack, or another operations system.
- Provide an HTTPS `INTERNAL_NOTIFICATION_QUEUE_URL` if the internal queue is selected.
- Optionally provide `INTERNAL_NOTIFICATION_QUEUE_TOKEN` and `INTERNAL_NOTIFICATION_QUEUE_TOPIC` for authenticated/topic-routed dispatch.
- Confirm recipients, escalation SLA wording, and audit retention expectations for import review escalations.
- Approve live-send mode only after a delivery attempt callback/audit event path is configured.

Until those decisions are complete, production should keep import escalation delivery in `manual_export` mode. The queue adapter only marks a live dispatch as sent after the configured HTTPS endpoint accepts the payload.
