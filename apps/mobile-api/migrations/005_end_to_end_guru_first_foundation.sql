CREATE TABLE IF NOT EXISTS guru_ai_sessions (
  id BIGSERIAL PRIMARY KEY,
  resident_id TEXT,
  intent TEXT NOT NULL DEFAULT 'general',
  user_message TEXT NOT NULL,
  assistant_reply TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local',
  model TEXT,
  safety_level TEXT NOT NULL DEFAULT 'normal',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_daily_plans (
  id BIGSERIAL PRIMARY KEY,
  resident_id TEXT,
  plan_date DATE NOT NULL DEFAULT CURRENT_DATE,
  plan JSONB NOT NULL,
  generated_by TEXT NOT NULL DEFAULT 'guru',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, plan_date)
);

CREATE TABLE IF NOT EXISTS guru_voice_sessions (
  id BIGSERIAL PRIMARY KEY,
  resident_id TEXT,
  status TEXT NOT NULL DEFAULT 'created',
  provider TEXT NOT NULL DEFAULT 'openai_realtime',
  ephemeral_token TEXT,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_provider_matches (
  id BIGSERIAL PRIMARY KEY,
  resident_id TEXT,
  request_type TEXT NOT NULL,
  provider_id TEXT,
  score NUMERIC(5,2) NOT NULL DEFAULT 0,
  reasoning JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'suggested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_ai_sessions_resident_created ON guru_ai_sessions (resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_provider_matches_request_type ON guru_provider_matches (request_type, score DESC);
