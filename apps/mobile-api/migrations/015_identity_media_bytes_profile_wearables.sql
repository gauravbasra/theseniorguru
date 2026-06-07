-- Durable mobile onboarding media bytes and profile display linkage.
-- Object storage should replace this byte table for scale, but this keeps v1 captures durable
-- and database-backed instead of storing only a phone-local URI.

ALTER TABLE identity_evidence
  DROP CONSTRAINT IF EXISTS identity_evidence_capture_method_check;

ALTER TABLE identity_evidence
  ADD CONSTRAINT identity_evidence_capture_method_check
  CHECK (capture_method IN ('camera','live_camera','upload','external_verification','healthkit','health_connect'));

ALTER TABLE identity_evidence
  DROP CONSTRAINT IF EXISTS identity_evidence_verification_status_check;

ALTER TABLE identity_evidence
  ADD CONSTRAINT identity_evidence_verification_status_check
  CHECK (verification_status IN ('pending','captured','verified','failed','manual_review','expired'));

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

CREATE TABLE IF NOT EXISTS media_object_bytes (
  media_object_id UUID PRIMARY KEY REFERENCES media_objects(id) ON DELETE CASCADE,
  content BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE residents
  ADD COLUMN IF NOT EXISTS profile_photo_media_object_id UUID REFERENCES media_objects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_photo_evidence_id UUID REFERENCES identity_evidence(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS display_name TEXT;

CREATE INDEX IF NOT EXISTS idx_residents_profile_photo_media
  ON residents(profile_photo_media_object_id);

CREATE INDEX IF NOT EXISTS idx_media_object_bytes_created
  ON media_object_bytes(created_at DESC);

CREATE TABLE IF NOT EXISTS wearable_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  account_id TEXT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','failed','revoked')),
  source TEXT NOT NULL,
  requested_data_types TEXT[] NOT NULL DEFAULT '{}',
  native_diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wearable_connections_resident
  ON wearable_connections(resident_id, provider);
