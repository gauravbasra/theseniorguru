# Public-Domain DNS Cutover Smoke

## Owner Dependency

Final `https://theseniorguru.com` browser smoke remains owner-dependent until DNS cutover approval is recorded, production canonical app URL is set, and DNS records point to the approved production deployment.

## Current Safe Path

- Use `POST /api/v1/system/public-domain-smoke` with `targetUrl: "https://theseniorguru.vercel.app"` to archive smoke evidence against the current production alias.
- Use `GET /api/v1/system/public-domain-smoke?targetUrl=https://theseniorguru.vercel.app` for a read-only preview.
- After DNS propagation, rerun the same endpoint with `targetUrl: "https://theseniorguru.com"`.

## Final-Domain Gates

- Owner DNS approval is `approved_ready_for_dns`.
- `NEXT_PUBLIC_APP_URL` is set to `https://theseniorguru.com` in production and redeployed.
- Public home, discover, operators, seniors, robots, and sitemap routes return expected content over HTTPS.
- Internal link health remains passing.

## Activation Gate

Do not mark DNS cutover complete until `POST /api/v1/system/public-domain-smoke` passes against `https://theseniorguru.com` and the audit evidence is attached to the DNS change record.
