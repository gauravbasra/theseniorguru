# Partner Production Smoke Live-Key Execution

## Blocker

Live partner smoke execution requires owner-approved production-mode API client credentials. The smoke suite is implemented as `/api/v1/admin/partner-smoke-suite`, but it must not mint or expose production secrets.

## Owner Decision Needed

- Approve the production API client purpose, scopes, partner owner, rate limit, and key custody path.
- Confirm whether claim and webhook write-path checks should run in production or remain sandbox-only.
- Provide the operator who will archive response headers, payload-shape evidence, and usage export after the smoke run.

## Current Safe Path

- Use `/api/v1/admin/partner-smoke-suite` for readiness evidence.
- Use `/api/v1/admin/partner-smoke-suite?format=csv` for review exports.
- Use `/api/v1/admin/partner-smoke-suite/live-readiness` and `/api/v1/admin/partner-smoke-suite/live-readiness?format=csv` for live-execution approval, key custody, write-path, and archive-owner evidence.
- Keep live execution blocked until production credentials and owner approval are available.

## Required Activation Values

- `PARTNER_LIVE_SMOKE_APPROVED`: set to `true` only after owner approval.
- `PARTNER_LIVE_SMOKE_APPROVED_BY`: named owner/operator approval.
- `PARTNER_LIVE_SMOKE_APPROVED_AT`: ISO timestamp for the approval decision.
- `PARTNER_LIVE_SMOKE_KEY_CUSTODY_REF`: reference to the owner-controlled production key custody location; never store the key in readiness output.
- `PARTNER_LIVE_SMOKE_ARCHIVE_OWNER`: operator responsible for archiving response status, headers, payload-shape evidence, and post-run usage export.
- `PARTNER_LIVE_SMOKE_ALLOW_WRITES`: optional `true` only if claim/webhook write-path smoke checks are approved for production; otherwise those checks remain sandbox-only.
- `PARTNER_LIVE_SMOKE_ARCHIVE_URL`: optional archive location for post-run evidence.
