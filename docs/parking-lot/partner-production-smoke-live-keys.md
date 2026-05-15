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
- Keep live execution blocked until production credentials and owner approval are available.
