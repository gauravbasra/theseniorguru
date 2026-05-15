# Newsroom RSS Live Cron Approval

## Parked Owner Decisions

- Confirm which approved RSS sources are allowed to stage live newsroom inbox items.
- Set `NEWSROOM_RSS_CRON_MODE=live` only after final editorial owner approval.
- Set `NEWSROOM_RSS_CRON_LIVE_APPROVED=true`, `NEWSROOM_RSS_CRON_APPROVED_BY`, and `NEWSROOM_RSS_CRON_APPROVED_AT` together so the cron route has auditable approval metadata.
- Review the first live worker run for source quality, duplicate detection, policy decisions, and staged item count.

## Current Implementation State

- Preview mode remains the default and runs with synthetic preview items.
- If live mode is enabled without approval metadata, `GET /api/cron/newsroom` records a failed scheduled-worker run with the exact missing gates and returns `424`.
- Approved live mode runs the existing RSS import worker against approved content sources only.
