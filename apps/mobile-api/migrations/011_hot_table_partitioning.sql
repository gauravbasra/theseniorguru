-- Hot append-only table partitioning primitives.
-- This migration is safe to apply on live databases because it creates partitioned
-- shadow parents and maintenance functions. Live cutover must be run after the
-- preflight query confirms the source table is drained/copied.

CREATE TABLE IF NOT EXISTS safety_telemetry_partitioned (
  LIKE safety_telemetry INCLUDING DEFAULTS
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS health_vitals_partitioned (
  LIKE health_vitals INCLUDING DEFAULTS
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS wearable_telemetry_partitioned (
  LIKE wearable_telemetry INCLUDING DEFAULTS
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS notifications_partitioned (
  LIKE notifications INCLUDING DEFAULTS
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS audit_logs_partitioned (
  LIKE audit_logs INCLUDING DEFAULTS
) PARTITION BY RANGE (created_at);

CREATE TABLE IF NOT EXISTS notification_delivery_attempts_partitioned (
  LIKE notification_delivery_attempts INCLUDING DEFAULTS
) PARTITION BY RANGE (attempted_at);

CREATE OR REPLACE FUNCTION ensure_monthly_partition(parent_table regclass, partition_start date)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  partition_end date := (partition_start + interval '1 month')::date;
  partition_name text := format('%s_%s', parent_table::text, to_char(partition_start, 'YYYY_MM'));
BEGIN
  EXECUTE format(
    'CREATE TABLE IF NOT EXISTS %I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
    partition_name,
    parent_table,
    partition_start,
    partition_end
  );
END;
$$;

CREATE OR REPLACE FUNCTION ensure_hot_table_partitions(months_ahead integer DEFAULT 3, months_behind integer DEFAULT 2)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  month_offset integer;
  month_start date;
BEGIN
  FOR month_offset IN -months_behind..months_ahead LOOP
    month_start := date_trunc('month', now() + (month_offset || ' months')::interval)::date;
    PERFORM ensure_monthly_partition('safety_telemetry_partitioned'::regclass, month_start);
    PERFORM ensure_monthly_partition('health_vitals_partitioned'::regclass, month_start);
    PERFORM ensure_monthly_partition('wearable_telemetry_partitioned'::regclass, month_start);
    PERFORM ensure_monthly_partition('notifications_partitioned'::regclass, month_start);
    PERFORM ensure_monthly_partition('audit_logs_partitioned'::regclass, month_start);
    PERFORM ensure_monthly_partition('notification_delivery_attempts_partitioned'::regclass, month_start);
  END LOOP;
END;
$$;

SELECT ensure_hot_table_partitions(6, 3);

CREATE INDEX IF NOT EXISTS idx_safety_telemetry_partitioned_resident_created
  ON safety_telemetry_partitioned(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_vitals_partitioned_resident_created
  ON health_vitals_partitioned(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_telemetry_partitioned_resident_created
  ON wearable_telemetry_partitioned(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_partitioned_user_status_created
  ON notifications_partitioned(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_partitioned_entity_created
  ON audit_logs_partitioned(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_attempts_partitioned_notification_created
  ON notification_delivery_attempts_partitioned(notification_id, attempted_at DESC);

CREATE OR REPLACE VIEW hot_table_partition_cutover_preflight AS
SELECT 'safety_telemetry' AS table_name, count(*)::bigint AS rows_to_copy FROM safety_telemetry
UNION ALL SELECT 'health_vitals', count(*)::bigint FROM health_vitals
UNION ALL SELECT 'wearable_telemetry', count(*)::bigint FROM wearable_telemetry
UNION ALL SELECT 'notifications', count(*)::bigint FROM notifications
UNION ALL SELECT 'audit_logs', count(*)::bigint FROM audit_logs
UNION ALL SELECT 'notification_delivery_attempts', count(*)::bigint FROM notification_delivery_attempts;

CREATE OR REPLACE FUNCTION copy_hot_table_data_to_partitions()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO safety_telemetry_partitioned SELECT * FROM safety_telemetry ON CONFLICT DO NOTHING;
  INSERT INTO health_vitals_partitioned SELECT * FROM health_vitals ON CONFLICT DO NOTHING;
  INSERT INTO wearable_telemetry_partitioned SELECT * FROM wearable_telemetry ON CONFLICT DO NOTHING;
  INSERT INTO notifications_partitioned SELECT * FROM notifications ON CONFLICT DO NOTHING;
  INSERT INTO audit_logs_partitioned SELECT * FROM audit_logs ON CONFLICT DO NOTHING;
  INSERT INTO notification_delivery_attempts_partitioned SELECT * FROM notification_delivery_attempts ON CONFLICT DO NOTHING;
END;
$$;
