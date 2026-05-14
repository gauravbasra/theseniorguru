# Parked Dependencies for Tomorrow

These items require owner credentials, production access, or confirmation. Implementation should continue around them.

## Supabase

- Create or provide the production Supabase project for The Senior Guru.
- Provide `NEXT_PUBLIC_SUPABASE_URL`.
- Provide `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Provide `SUPABASE_SERVICE_ROLE_KEY` for server-only API routes and import workers.
- Add the three Supabase variables to Vercel Production; current production writes are intentionally marked `fallback_memory` by `/api/v1/system/persistence` until these are present.
- Apply committed migrations through `20260511102000_import_idempotency.sql` before persistent staging/import runs.
- Confirm whether Supabase Auth will use email/password, magic links, Google OAuth, or all of the above.

## Hosting

- Review current Vercel work-in-progress deployment at `https://theseniorguru.vercel.app`.
- Confirm/set `CRON_SECRET` in Vercel Production so `/api/cron/operations`, `/api/cron/acquisition`, and `/api/cron/newsroom` can run from Vercel Cron.
- Confirm when to set `WEBHOOK_RETRY_CRON_MODE=live`; `/api/cron/webhooks` defaults to preview-only candidate reporting until partner webhook targets and signing secrets are confirmed.
- Confirm when to set `NEWSROOM_RSS_CRON_MODE=live`; it intentionally defaults to safe preview/dry-run mode until editorial RSS intake is approved.
- Confirm whether `theseniorguru.com` should point to Vercel now or remain on DigitalOcean until the production Supabase/email/ads credentials are installed.
- Confirm whether a droplet is still required for `theseniorguru.com` after the Vercel deployment.
- Confirm whether TheVaulted server is distinct from `147.182.129.38`.
- Confirm that `thevaulted.com` must remain untouched except for safe inspection.
- Provide SSH target if TheVaulted is a different server.

## DNS

- Confirm whether `theseniorguru.com` should continue pointing to `143.198.188.246`, move to Vercel, or move to the selected hosting droplet.
- Confirm approval before changing any live DNS record.

## Email and Sending

- Confirm Mailjet credentials and approved sender domains.
- Confirm when newsletter delivery can use live Mailjet send mode; `/api/v1/admin/newsroom/newsletters/{id}/delivery-preview` currently exposes the provider payload and blocks live Mailjet readiness until credentials are installed.
- Provide `NEWSLETTER_MAILJET_SENDER_EMAIL` and confirm `NEWSLETTER_MAILJET_SEND_MODE=live` only after sender approval, audience-recipient export policy, unsubscribe handling, and owner approval are complete; `/api/v1/admin/newsroom/newsletters/{id}/send` records blocked/dry-run/manual-export delivery attempts until then.
- Confirm Google Workspace inboxes needed for provider outreach.

## Legal/Policy Review

- Review the Policy Guardrail and Governance Engine before public launch.
- Confirm state-by-state launch markets for senior referral/disclosure review.
- Approve each production public-source acquisition source before live ingestion, including source URL, license/terms status, robots decision, allowed adapter type, attribution requirements, and refresh cadence.
- Confirm image handling policy for sourced listing images: storage workflow, review owner, attribution display, rejection rules, and whether any source permits reuse beyond staging.
- Provide any official directory/API credentials or data use agreements required for CMS, state licensing, county agency, provider registry, or open data imports.
- Confirm production run limits and refresh cadence for current TheSeniorGuru.com public listing acquisition; current worker honors robots and stages image URLs as enrichment-later metadata pending owner media policy.

## Google Ads/Publishing

- Confirm Google Ad Manager or AdSense account access.
- Confirm whether we use direct-sold campaigns first, Google backfill second.

## Billing

- Confirm whether provider growth subscriptions should launch with Stripe, invoices, ACH, or manual contracts first.
- Confirm exact launch pricing for Growth Starter, Reputation Plus, Community Events, and Growth Pro.
- Confirm who can activate a provider contract after signature.

## Mobile

- Confirm iOS/Android developer account access.
- Confirm app name, icon direction, and launch markets.
