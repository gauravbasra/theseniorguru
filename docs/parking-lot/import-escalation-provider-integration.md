# Import Escalation Provider Integration

Status: owner-dependent

The import escalation notification workflow now supports manual export delivery and reports internal notification queue readiness through `/api/v1/admin/extracted-entities/escalations/delivery-readiness`.

Owner decisions needed before live non-manual dispatch:

- Approve the live escalation provider: internal notification queue, email, Slack, or another operations system.
- Provide queue/topic credentials such as `INTERNAL_NOTIFICATION_QUEUE_URL` or `INTERNAL_NOTIFICATION_QUEUE_TOPIC` if the internal queue is selected.
- Confirm recipients, escalation SLA wording, and audit retention expectations for import review escalations.
- Approve live-send mode only after a delivery attempt callback/audit event path is configured.

Until those decisions are complete, production should keep import escalation delivery in `manual_export` mode.
