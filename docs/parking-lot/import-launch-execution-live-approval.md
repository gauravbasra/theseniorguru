# Import Launch Execution Live Approval

Owner approval is required before `POST /api/v1/admin/import-launch-execution` can run with `dryRun=false`.

Required production metadata:

- Set `IMPORT_LAUNCH_EXECUTION_LIVE_APPROVED=true` only after the owner approves live launch import execution.
- Set `IMPORT_LAUNCH_EXECUTION_APPROVED_BY` to the owner/admin who approved live launch imports.
- Set `IMPORT_LAUNCH_EXECUTION_APPROVED_AT` to a valid ISO timestamp for the approval.
- Confirm Supabase persistence is active and the current-site/CMS/state source limits are approved before enabling live imports.

Until those values are configured, the endpoint remains preview-safe and returns approval blockers instead of staging launch inventory live.
