-- Guru Cost Governance v2.
-- Formal AI routing policies, daily usage aggregation, fallback audit, and
-- required invocation fields for tenant/senior budget control.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_routing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intent TEXT NOT NULL UNIQUE,
  route_class TEXT NOT NULL CHECK (route_class IN ('local_only','remote_allowed','emergency_bypass')),
  remote_allowed BOOLEAN NOT NULL DEFAULT false,
  min_local_confidence NUMERIC(4,2) NOT NULL DEFAULT 0.70,
  cache_ttl_seconds INT NOT NULL DEFAULT 86400,
  cache_allowed BOOLEAN NOT NULL DEFAULT true,
  emergency_bypass BOOLEAN NOT NULL DEFAULT false,
  degradation_mode TEXT NOT NULL DEFAULT 'local_scripted',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_date DATE NOT NULL DEFAULT current_date,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  senior_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model_name TEXT,
  request_count INT NOT NULL DEFAULT 0,
  remote_request_count INT NOT NULL DEFAULT 0,
  cache_hit_count INT NOT NULL DEFAULT 0,
  prompt_tokens INT NOT NULL DEFAULT 0,
  completion_tokens INT NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0,
  latency_ms_total BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (usage_date, tenant_id, senior_id, provider, model_name)
);

CREATE TABLE IF NOT EXISTS ai_fallback_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL DEFAULT 'default',
  intent TEXT NOT NULL,
  requested_provider TEXT,
  actual_provider TEXT NOT NULL,
  route_reason TEXT NOT NULL,
  local_confidence NUMERIC(4,2),
  budget_mode TEXT NOT NULL DEFAULT 'normal',
  budget_scope TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  intent TEXT NOT NULL,
  response TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'local_small_language_model',
  model_name TEXT,
  cache_safety TEXT NOT NULL DEFAULT 'safe',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '24 hours',
  hit_count INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE guru_model_invocations ADD COLUMN IF NOT EXISTS senior_id UUID REFERENCES residents(id) ON DELETE CASCADE;
UPDATE guru_model_invocations SET senior_id = resident_id WHERE senior_id IS NULL AND resident_id IS NOT NULL;
ALTER TABLE guru_model_invocations ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'default';
ALTER TABLE guru_model_invocations ADD COLUMN IF NOT EXISTS model_name TEXT;
UPDATE guru_model_invocations SET model_name = model WHERE model_name IS NULL;
ALTER TABLE guru_model_invocations ADD COLUMN IF NOT EXISTS estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0;
ALTER TABLE guru_model_invocations ADD COLUMN IF NOT EXISTS route_reason TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE guru_model_invocations ADD COLUMN IF NOT EXISTS local_confidence NUMERIC(4,2);
ALTER TABLE guru_model_invocations ADD COLUMN IF NOT EXISTS latency_ms INT NOT NULL DEFAULT 0;

ALTER TABLE ai_budget_windows ADD COLUMN IF NOT EXISTS tenant_id TEXT;
ALTER TABLE ai_budget_windows ADD COLUMN IF NOT EXISTS senior_id UUID REFERENCES residents(id) ON DELETE CASCADE;
ALTER TABLE ai_budget_windows ADD COLUMN IF NOT EXISTS window_type TEXT NOT NULL DEFAULT 'custom';
ALTER TABLE ai_budget_windows ADD COLUMN IF NOT EXISTS max_estimated_cost_usd NUMERIC(12,6) NOT NULL DEFAULT 0;
ALTER TABLE ai_budget_windows ADD COLUMN IF NOT EXISTS estimated_cost_usd_used NUMERIC(12,6) NOT NULL DEFAULT 0;
ALTER TABLE ai_budget_windows ADD COLUMN IF NOT EXISTS warning_threshold NUMERIC(4,2) NOT NULL DEFAULT 0.70;
ALTER TABLE ai_budget_windows ADD COLUMN IF NOT EXISTS throttle_threshold NUMERIC(4,2) NOT NULL DEFAULT 0.90;
ALTER TABLE ai_budget_windows ADD COLUMN IF NOT EXISTS hard_cap_reached BOOLEAN NOT NULL DEFAULT false;

INSERT INTO ai_routing_policies (intent, route_class, remote_allowed, min_local_confidence, cache_allowed, emergency_bypass, notes)
VALUES
  ('medication', 'local_only', false, 0.70, false, false, 'Medication status must be answered from local data.'),
  ('calendar', 'local_only', false, 0.70, true, false, 'Schedule lookup is deterministic.'),
  ('environment', 'local_only', false, 0.70, true, false, 'Weather guidance uses stored environmental intelligence.'),
  ('daily_status', 'local_only', false, 0.70, false, false, 'Daily status uses scored Guru intelligence.'),
  ('family', 'local_only', false, 0.70, false, false, 'Family contact uses trusted-circle data.'),
  ('safety', 'emergency_bypass', false, 0.70, false, true, 'SOS routing must never be blocked by budget.'),
  ('ride', 'local_only', false, 0.70, true, false, 'Service matching and ride intake are deterministic.'),
  ('services', 'local_only', false, 0.70, true, false, 'Service matching is deterministic.'),
  ('task', 'local_only', false, 0.70, true, false, 'Simple reminders are local.'),
  ('location', 'local_only', false, 0.70, false, false, 'Location and safe-zone questions use local context.'),
  ('health_summary', 'local_only', false, 0.70, false, false, 'Health explanations use existing scores.'),
  ('companion', 'remote_allowed', true, 0.70, false, false, 'Open-ended companionship may use remote AI when budget allows.'),
  ('story', 'remote_allowed', true, 0.70, true, false, 'Storytelling may use remote AI when budget allows.'),
  ('complex_reasoning', 'remote_allowed', true, 0.70, false, false, 'Complex multi-step requests may use remote AI.'),
  ('emotional_support', 'remote_allowed', true, 0.70, false, false, 'Emotional support may use remote AI when budget allows.'),
  ('vision', 'remote_allowed', true, 0.70, false, false, 'Vision/image interpretation may use remote model.'),
  ('multilingual', 'remote_allowed', true, 0.70, false, false, 'Multilingual natural conversation may use remote AI.')
ON CONFLICT (intent) DO UPDATE SET
  route_class = EXCLUDED.route_class,
  remote_allowed = EXCLUDED.remote_allowed,
  min_local_confidence = EXCLUDED.min_local_confidence,
  cache_allowed = EXCLUDED.cache_allowed,
  emergency_bypass = EXCLUDED.emergency_bypass,
  notes = EXCLUDED.notes,
  updated_at = now();

CREATE INDEX IF NOT EXISTS idx_ai_routing_policies_status ON ai_routing_policies(status, intent);
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_tenant_date ON ai_usage_daily(tenant_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_daily_senior_date ON ai_usage_daily(senior_id, usage_date DESC);
CREATE INDEX IF NOT EXISTS idx_ai_fallback_events_senior_created ON ai_fallback_events(senior_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_response_cache_expires ON ai_response_cache(cache_key, expires_at);
CREATE INDEX IF NOT EXISTS idx_guru_model_invocations_senior_created ON guru_model_invocations(senior_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_model_invocations_tenant_created ON guru_model_invocations(tenant_id, created_at DESC);
