# Parked Dependencies for Tomorrow

These items require owner credentials, production access, or confirmation. Implementation should continue around them.

## Supabase

- Create or provide the production Supabase project for The Senior Guru.
- Provide `NEXT_PUBLIC_SUPABASE_URL`.
- Provide `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Provide `SUPABASE_SERVICE_ROLE_KEY` for server-only API routes and import workers.
- Confirm whether Supabase Auth will use email/password, magic links, Google OAuth, or all of the above.

## Hosting

- Review current Vercel work-in-progress deployment at `https://theseniorguru.vercel.app`.
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
- Confirm Google Workspace inboxes needed for provider outreach.

## Legal/Policy Review

- Review the Policy Guardrail and Governance Engine before public launch.
- Confirm state-by-state launch markets for senior referral/disclosure review.
- Approve each production public-source acquisition source before live ingestion, including source URL, license/terms status, robots decision, allowed adapter type, attribution requirements, and refresh cadence.
- Confirm image handling policy for sourced listing images: storage workflow, review owner, attribution display, rejection rules, and whether any source permits reuse beyond staging.
- Provide any official directory/API credentials or data use agreements required for CMS, state licensing, county agency, provider registry, or open data imports.

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
