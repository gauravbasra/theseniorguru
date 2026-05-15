# Review Request Third-Party Delivery Approval

Owner approval and provider credentials are required before live Mailjet or Google review request handoff is enabled.

## Current Status

The review request campaign send route now supports dry-run preview, manual export evidence, internal notification queue processing, per-recipient delivery payloads, and audit events.

## Parked Decisions

- Confirm whether launch review requests should use Mailjet, Google Business Profile, or an owned CRM/reputation provider.
- Approve sender identity, reply-to handling, unsubscribe/consent wording, and escalation ownership.
- Install tenant/provider credentials and confirm whether delivery receipts or callbacks are required.
- Keep Mailjet and Google provider sends blocked until credentials and approval gates are configured.

## Safe Interim Path

Use `deliveryProvider: "manual_export"` for operator-reviewed delivery evidence or `deliveryProvider: "internal_notification_queue"` for internal queue processing. Third-party provider choices intentionally fail safely until the owner-controlled setup is complete.
