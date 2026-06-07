-- Retention and archive jobs for high-volume operational data.

CREATE TABLE IF NOT EXISTS audit_logs_archive (LIKE audit_logs INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE IF NOT EXISTS notifications_archive (LIKE notifications INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE IF NOT EXISTS notification_delivery_attempts_archive (LIKE notification_delivery_attempts INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE IF NOT EXISTS safety_telemetry_archive (LIKE safety_telemetry INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE IF NOT EXISTS health_vitals_archive (LIKE health_vitals INCLUDING DEFAULTS INCLUDING CONSTRAINTS);
CREATE TABLE IF NOT EXISTS wearable_telemetry_archive (LIKE wearable_telemetry INCLUDING DEFAULTS INCLUDING CONSTRAINTS);

CREATE TABLE IF NOT EXISTS retention_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cutoff_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  archived_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_retention_runs_started ON retention_runs(started_at DESC);

CREATE OR REPLACE FUNCTION archive_old_operational_data(cutoff_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  run_id uuid;
  counts jsonb := '{}'::jsonb;
  moved bigint;
BEGIN
  INSERT INTO retention_runs (cutoff_at) VALUES (cutoff_at) RETURNING id INTO run_id;

  WITH moved_rows AS (
    DELETE FROM notification_delivery_attempts WHERE attempted_at < cutoff_at RETURNING *
  ), inserted AS (
    INSERT INTO notification_delivery_attempts_archive SELECT * FROM moved_rows RETURNING 1
  )
  SELECT count(*) INTO moved FROM inserted;
  counts := counts || jsonb_build_object('notification_delivery_attempts', moved);

  WITH moved_rows AS (
    DELETE FROM notifications WHERE created_at < cutoff_at AND status IN ('sent','failed','cancelled') RETURNING *
  ), inserted AS (
    INSERT INTO notifications_archive SELECT * FROM moved_rows RETURNING 1
  )
  SELECT count(*) INTO moved FROM inserted;
  counts := counts || jsonb_build_object('notifications', moved);

  WITH moved_rows AS (
    DELETE FROM safety_telemetry WHERE created_at < cutoff_at RETURNING *
  ), inserted AS (
    INSERT INTO safety_telemetry_archive SELECT * FROM moved_rows RETURNING 1
  )
  SELECT count(*) INTO moved FROM inserted;
  counts := counts || jsonb_build_object('safety_telemetry', moved);

  WITH moved_rows AS (
    DELETE FROM health_vitals WHERE created_at < cutoff_at RETURNING *
  ), inserted AS (
    INSERT INTO health_vitals_archive SELECT * FROM moved_rows RETURNING 1
  )
  SELECT count(*) INTO moved FROM inserted;
  counts := counts || jsonb_build_object('health_vitals', moved);

  WITH moved_rows AS (
    DELETE FROM wearable_telemetry WHERE created_at < cutoff_at RETURNING *
  ), inserted AS (
    INSERT INTO wearable_telemetry_archive SELECT * FROM moved_rows RETURNING 1
  )
  SELECT count(*) INTO moved FROM inserted;
  counts := counts || jsonb_build_object('wearable_telemetry', moved);

  WITH moved_rows AS (
    DELETE FROM audit_logs WHERE created_at < cutoff_at RETURNING *
  ), inserted AS (
    INSERT INTO audit_logs_archive SELECT * FROM moved_rows RETURNING 1
  )
  SELECT count(*) INTO moved FROM inserted;
  counts := counts || jsonb_build_object('audit_logs', moved);

  UPDATE retention_runs
  SET status = 'succeeded', archived_counts = counts, completed_at = now()
  WHERE id = run_id;

  RETURN counts;
EXCEPTION WHEN OTHERS THEN
  UPDATE retention_runs
  SET status = 'failed', error = SQLERRM, completed_at = now()
  WHERE id = run_id;
  RAISE;
END;
$$;
