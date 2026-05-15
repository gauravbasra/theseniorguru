# AI Voice Provider Activation

Owner approval and production credentials are required before live AI voice telephony is enabled.

## Current Status

The provider voice assistant API now reports AI voice entitlement readiness, builds compliant greeting and missed-call payloads, records internal queue/manual export evidence, and blocks live Twilio, Retell, or ElevenLabs handoff until credentials are installed.

## Parked Decisions

- Confirm the live voice provider: Twilio, Retell, ElevenLabs with a telephony bridge, or another approved vendor.
- Approve phone numbers, transfer routing, after-hours escalation, and call recording consent language.
- Confirm whether missed calls should capture callbacks, route to staff, or send SMS follow-up.
- Install production credentials and define delivery callback/audit requirements.

## Safe Interim Path

Use `/api/v1/provider/voice-assistant` with `dryRun: true` for payload review, or `deliveryProvider: "manual_export"` / `deliveryProvider: "internal_notification_queue"` for non-telephony launch evidence. Keep third-party live provider delivery blocked until the owner-controlled activation checklist is complete.
