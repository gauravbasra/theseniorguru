-- Phase 4: Guru Health + Safety Copilot
-- Adds durable records for native health insights, wearable risk reviews, AR guidance sessions,
-- and Guru safety-copilot decisions. These tables are additive and do not change existing APIs.

CREATE TABLE IF NOT EXISTS guru_phase4_sessions (
  id TEXT PRIMARY KEY,
  resident_id TEXT,
  risk_level TEXT NOT NULL DEFAULT 'low',
  summary TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  vitals JSONB,
  wearables JSONB,
  safety JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_health_insights (
  id TEXT PRIMARY KEY,
  resident_id TEXT,
  diagnostics JSONB,
  risk_level TEXT NOT NULL DEFAULT 'low',
  summary TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_wearable_insights (
  id TEXT PRIMARY KEY,
  resident_id TEXT,
  scenario_kind TEXT NOT NULL DEFAULT 'normal',
  risk_level TEXT NOT NULL DEFAULT 'low',
  summary TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  wearables JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_safety_copilot_events (
  id TEXT PRIMARY KEY,
  resident_id TEXT,
  scenario TEXT NOT NULL DEFAULT 'review',
  risk_level TEXT NOT NULL DEFAULT 'watch',
  summary TEXT NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_ar_guidance_sessions (
  id TEXT PRIMARY KEY,
  resident_id TEXT,
  scene TEXT NOT NULL,
  prompt TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
