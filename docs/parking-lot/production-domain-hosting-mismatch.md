# Production Domain Hosting Mismatch

## Observed Blocker

- `https://www.theseniorguru.com` is not currently serving the pushed Next.js app routes.
- Local verification saw an expired TLS certificate on the public host.
- With TLS verification bypassed, the host returned Apache `404` HTML for Next API routes such as `/api/cron/newsroom` and `/api/v1/admin/newsroom/newsletters/{id}/audience-export`.

## Required Owner/Deployment Actions

- Confirm whether the final public domain should point to Vercel or to the existing Apache server.
- Renew or replace the TLS certificate before public launch smoke is considered valid.
- Point `theseniorguru.com` and `www.theseniorguru.com` to the production Next deployment target.
- Rerun `GET /api/v1/system/public-domain-smoke?targetUrl=https://www.theseniorguru.com` after DNS/TLS changes.

## Current Implementation State

- Public-domain smoke now checks a public runtime-marker API surface and captures server/runtime headers.
- Apache, wrong-origin, expired-cert, and non-Next responses are treated as launch blockers in the smoke evidence.
