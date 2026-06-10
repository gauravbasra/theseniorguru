# Production Scale Hardening

This app now has the database and worker primitives required before a large user rollout. These changes are not a substitute for running the migrations against production, attaching a real object-storage provider, and executing load tests against the deployed stack.

## Partitioning

Migration `apps/mobile-api/migrations/011_hot_table_partitioning.sql` creates partitioned shadow parents for hot append-only data:

- `safety_telemetry_partitioned`
- `health_vitals_partitioned`
- `wearable_telemetry_partitioned`
- `notifications_partitioned`
- `audit_logs_partitioned`
- `notification_delivery_attempts_partitioned`

The migration also creates `ensure_hot_table_partitions`, `ensure_monthly_partition`, `copy_hot_table_data_to_partitions`, and `hot_table_partition_cutover_preflight`.

The partition migration intentionally creates shadow parents instead of renaming live tables. Production cutover still needs a controlled migration window:

1. Apply migration `011`.
2. Run `SELECT ensure_hot_table_partitions(6, 3);`.
3. Review `SELECT * FROM hot_table_partition_cutover_preflight;`.
4. Copy data with `SELECT copy_hot_table_data_to_partitions();`.
5. Cut application writes to the partitioned tables or run a follow-up rename migration after verifying row counts and write downtime.

## Row-level security

Migration `apps/mobile-api/migrations/012_rls_security_policies.sql` enables Row-level security on user, resident, trusted-circle, medication, health, wearable, safety, booking, message, business, media evidence, and audit tables.

The migration provides policy helpers:

- `app_current_user_id()`
- `app_current_user_role()`
- `app_is_admin()`
- `app_user_resident_ids()`
- `app_trusted_resident_ids()`
- `app_user_business_ids()`

Direct database clients must set request context inside the same transaction before touching protected rows:

```sql
SELECT set_config('app.current_user_id', '<user uuid>', true);
SELECT set_config('app.current_user_role', '<role>', true);
```

The current Node API already enforces role and owner checks in route code. RLS now protects direct SQL clients and future transaction-scoped handlers; do not switch pooled session-level settings because they can leak between users.

## Object storage

Migration `apps/mobile-api/migrations/013_media_storage_queue_retention.sql` adds `media_objects`. The production API now has:

- `POST /api/media/upload-url`
- `POST /api/media/download-url`
- `POST /api/media/evidence`

Photo and video bytes should go to object storage using the signed URL returned by `/api/media/upload-url`; the database stores only metadata, ownership, storage key, checksums, and URL expiry windows.

Required production env:

- `MEDIA_STORAGE_PUBLIC_BASE_URL`
- `MEDIA_SIGNING_SECRET`
- `MEDIA_UPLOAD_URL_TTL_MS`
- `MEDIA_DOWNLOAD_URL_TTL_MS`

The current signer is provider-neutral. If S3, GCS, or Supabase Storage is selected, replace `signStorageUrl` with that provider's native signed URL API while keeping `media_objects` as the source of truth.

## Queue workers

Migration `013` also adds `job_queue` and `enqueue_job`. The API enqueues jobs for:

- `notification_delivery`
- `telemetry_ingest`
- `ride_dispatch`
- `media_postprocess`
- `retention_archive`

Worker command:

```bash
npm run worker:jobs
```

The worker claims jobs with `FOR UPDATE SKIP LOCKED`, so multiple worker processes can run concurrently without processing the same job. Configure queue selection with `JOB_QUEUES=notifications,telemetry,dispatch,media,retention`.

## Retention And Archive

Migration `apps/mobile-api/migrations/014_retention_archive_jobs.sql` adds archive tables and `archive_old_operational_data`.

Runner command:

```bash
RETENTION_CUTOFF_DAYS=180 npm run retention:archive
```

Archived tables:

- `audit_logs_archive`
- `notifications_archive`
- `notification_delivery_attempts_archive`
- `safety_telemetry_archive`
- `health_vitals_archive`
- `wearable_telemetry_archive`

Run retention jobs during low-traffic windows, and keep backups/snapshots before the first production archive run.

## Load testing

Load test command:

```bash
API_BASE_URL=https://your-mobile-api.example.com \
LOAD_TEST_TOKEN=<senior-session-token> \
LOAD_TEST_USERS=100 \
LOAD_TEST_ITERATIONS=50 \
LOAD_TEST_CONCURRENCY=25 \
npm run load-test:production
```

The load test hits these high-volume endpoints:

- `/api/health/vitals`
- `/api/safety/phone-analytics`
- `/api/messages`
- `/api/bookings`

It reports success count, status distribution, p50, p95, p99, and sample failures.

## Rollout Gate

Before calling this ready for millions of users:

1. Apply migrations `011` through `014` against a staging clone.
2. Verify RLS with senior, trusted-circle, business, and admin sessions.
3. Configure real object storage and replace the provider-neutral signer if needed.
4. Run at least two queue workers under process supervision.
5. Run retention/archive on staging with production-like row counts.
6. Run load tests against staging and production canary, then review DB CPU, locks, p95/p99 latency, queue lag, and error rates.
