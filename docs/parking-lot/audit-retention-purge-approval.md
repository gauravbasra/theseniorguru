# Audit Retention Purge Approval

## Status

Owner/legal approval required before any live audit-event purge can be enabled.

## Why this is parked

Audit events are compliance and launch-approval evidence across policy, claims, imports, reviews, newsroom, ads, and partner API workflows. The platform now supports export and retention-candidate preview, but destructive purge execution must wait for approved retention duration, legal hold rules, archive storage location, and named approver policy.

## Current safe path

- Use `/api/v1/admin/audit-events/export` for JSON or CSV evidence export.
- Use `/api/v1/admin/audit-events/retention` to preview retention candidates.
- Keep live purge blocked until owner/legal signoff is documented.
