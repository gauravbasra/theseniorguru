# Credential Evidence Retention Purge Approval

## Owner Dependency

Credential smoke evidence is production launch evidence. The platform now supports retention dashboarding, CSV export, and retention-candidate review, but destructive purge execution is blocked until the owner approves retention policy and legal hold requirements.

## Current Safe Path

- Use `GET /api/v1/system/credential-evidence-retention` for archive counts, current credential smoke status, retention cutoff, and retention candidates.
- Use `GET /api/v1/system/credential-evidence-retention?format=csv` to export credential archive evidence for compliance review.
- Use `POST /api/v1/system/credential-evidence-retention` with `dryRun: true` to archive a retention review audit event.
- `dryRun: false` remains blocked and records the blocker instead of purging evidence.

## Required Owner Inputs

- Approved credential evidence retention duration.
- Legal hold rules for launch, security, credential, incident, and provider-access evidence.
- Archive storage location for exported CSV evidence.
- Named approver policy for enabling any destructive purge workflow.

## Activation Gate

Do not enable live purge execution until owner/legal approval is recorded and export archive storage is verified.
