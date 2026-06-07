-- Object storage metadata and durable queue tables.

CREATE TABLE IF NOT EXISTS media_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  identity_evidence_id UUID REFERENCES identity_evidence(id) ON DELETE SET NULL,
  bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL UNIQUE,
  original_file_name TEXT,
  content_type TEXT NOT NULL,
  byte_size BIGINT,
  checksum_sha256 TEXT,
  upload_url TEXT,
  download_url TEXT,
  upload_expires_at TIMESTAMPTZ,
  download_expires_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending_upload' CHECK (status IN ('pending_upload','uploaded','quarantined','deleted')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_objects_owner_created ON media_objects(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_objects_resident_created ON media_objects(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_objects_status_created ON media_objects(status, created_at DESC);

CREATE TABLE IF NOT EXISTS job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name TEXT NOT NULL,
  job_type TEXT NOT NULL CHECK (job_type IN ('notification_delivery','telemetry_ingest','ride_dispatch','media_postprocess','retention_archive')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','processing','succeeded','failed','dead')),
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  run_after TIMESTAMPTZ NOT NULL DEFAULT now(),
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_job_queue_ready ON job_queue(queue_name, status, run_after, created_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_type_status ON job_queue(job_type, status, created_at DESC);

CREATE OR REPLACE FUNCTION enqueue_job(
  queue_name text,
  job_type text,
  payload jsonb,
  run_after timestamptz DEFAULT now(),
  max_attempts integer DEFAULT 5
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  job_id uuid;
BEGIN
  INSERT INTO job_queue (queue_name, job_type, payload, run_after, max_attempts)
  VALUES (queue_name, job_type, COALESCE(payload, '{}'::jsonb), COALESCE(run_after, now()), max_attempts)
  RETURNING id INTO job_id;
  RETURN job_id;
END;
$$;
