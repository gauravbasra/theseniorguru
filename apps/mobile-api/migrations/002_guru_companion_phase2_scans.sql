CREATE TABLE IF NOT EXISTS guru_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL,
  label TEXT,
  source TEXT,
  image_uri TEXT,
  file_name TEXT,
  width INT,
  height INT,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'analyzed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_scans_resident_created ON guru_scans (resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_scans_type ON guru_scans (scan_type);

ALTER TABLE guru_scan_intents ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE guru_scan_intents ADD COLUMN IF NOT EXISTS image_uri TEXT;
ALTER TABLE guru_scan_intents ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
