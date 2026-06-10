-- Guru local model and AI spend controls.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS guru_model_invocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT,
  intent TEXT NOT NULL DEFAULT 'general',
  route TEXT NOT NULL,
  used_remote_ai BOOLEAN NOT NULL DEFAULT false,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_cents NUMERIC(10,4) NOT NULL DEFAULT 0,
  cache_hit BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  intent TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local_small_language_model',
  reply TEXT NOT NULL,
  navigate_to TEXT,
  safety_level TEXT NOT NULL DEFAULT 'normal',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  hit_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_budget_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  max_remote_calls INT NOT NULL DEFAULT 0,
  max_estimated_cost_cents NUMERIC(10,4) NOT NULL DEFAULT 0,
  remote_calls_used INT NOT NULL DEFAULT 0,
  estimated_cost_cents_used NUMERIC(10,4) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scope_key, window_start, window_end)
);

CREATE INDEX IF NOT EXISTS idx_guru_model_invocations_resident_created
  ON guru_model_invocations(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_model_invocations_provider_created
  ON guru_model_invocations(provider, used_remote_ai, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_budget_windows_scope_status
  ON ai_budget_windows(scope_key, status, window_end DESC);
