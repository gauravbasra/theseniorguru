-- Chunked identity evidence uploads for liveness videos.
-- Avoids sending large videos as a single JSON request body.

CREATE TABLE IF NOT EXISTS media_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  identity_evidence_id UUID REFERENCES identity_evidence(id) ON DELETE CASCADE,
  subject_role TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_file_name TEXT,
  content_type TEXT NOT NULL,
  expected_byte_size BIGINT,
  total_chunks INT,
  received_chunks INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'receiving' CHECK (status IN ('receiving','completed','failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS media_upload_chunks (
  upload_session_id UUID NOT NULL REFERENCES media_upload_sessions(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content BYTEA NOT NULL,
  byte_size INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_session_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_media_upload_sessions_owner_created
  ON media_upload_sessions(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_upload_sessions_evidence
  ON media_upload_sessions(identity_evidence_id);
