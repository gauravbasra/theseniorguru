# Newsletter Mailjet Live Send Approval

## Parked Owner Decisions

- Provide production Mailjet API key, API secret, and approved newsletter sender email.
- Confirm Mailjet sender/domain approval outside the app before enabling live sends.
- Set `NEWSLETTER_MAILJET_SEND_MODE=live` only after sender approval and final audience review.
- Confirm the production recipient consent source and suppression-list handling.
- Give final owner approval for the first live Mailjet dispatch after reviewing the audience export.

## Current Implementation State

- Manual export can produce consent-segmented synthetic recipient evidence through `POST /api/v1/admin/newsroom/newsletters/{id}/audience-export`.
- Mailjet export reports exact missing readiness gates and stays blocked until credentials, sender approval, live send mode, and owner approval are all present.
- The newsletter send endpoint still prevents live Mailjet dispatch until these owner-dependent gates are resolved.
