# Google Ad Manager Activation

Owner approval and production Google credentials are required before live Google Ad Manager or AdSense backfill sync is enabled.

## Current Status

The platform now supports a protected Google ad-unit sync workflow that can preview or record manual-export evidence for direct-sold-first placements. Live Google sync is intentionally blocked until credentials and ad-unit review are complete.

## Parked Decisions

- Confirm whether launch uses Google Ad Manager, AdSense, or direct-sold-only inventory.
- Provide Google OAuth client ID, client secret, developer token, network/account identifiers, and approved ad-unit naming rules.
- Approve placement-to-ad-unit mapping, disclosure rules, frequency cap policy, and fallback priority.
- Confirm who reviews ad-unit payload exports before enabling live sync.

## Safe Interim Path

Use `/api/v1/admin/ads/google-sync` with `mode: "preview"` to inspect ad-unit payloads, or `mode: "manual_export"` with `dryRun: false` to archive review evidence without contacting Google. Keep `mode: "google_ad_manager"` blocked until credentials and owner approval are complete.
