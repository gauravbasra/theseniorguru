-- Guru Intelligence Phase 2.
-- Explanation, baseline, trend, recommendation, and family context engine.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS family_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  relationship TEXT NOT NULL,
  display_name TEXT NOT NULL,
  priority INT NOT NULL DEFAULT 10,
  can_receive_checkin BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, user_id, relationship)
);

CREATE TABLE IF NOT EXISTS family_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  family_relationship_id UUID REFERENCES family_relationships(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  interaction_type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'unknown',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  window_days INT NOT NULL DEFAULT 30,
  baseline_value NUMERIC,
  sample_count INT NOT NULL DEFAULT 0,
  unit TEXT,
  computed_from DATE,
  computed_to DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, metric_key, window_days)
);

CREATE TABLE IF NOT EXISTS guru_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  window_days INT NOT NULL,
  current_value NUMERIC,
  baseline_value NUMERIC,
  delta_value NUMERIC,
  delta_percent NUMERIC,
  direction TEXT NOT NULL DEFAULT 'flat',
  significance TEXT NOT NULL DEFAULT 'normal',
  explanation TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, metric_key, window_days)
);

CREATE TABLE IF NOT EXISTS guru_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  recommendation_date DATE NOT NULL DEFAULT current_date,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  why TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'inform',
  priority INT NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'open',
  source_risk_score_id UUID REFERENCES guru_risk_scores(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_explanations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  explanation_date DATE NOT NULL DEFAULT current_date,
  status TEXT NOT NULL,
  confidence INT NOT NULL DEFAULT 75,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  what_changed JSONB NOT NULL DEFAULT '[]'::jsonb,
  why_it_matters JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  family_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  plain_language_summary TEXT NOT NULL DEFAULT '',
  source_risk_score_id UUID REFERENCES guru_risk_scores(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, explanation_date)
);

CREATE INDEX IF NOT EXISTS idx_family_relationships_senior_priority
  ON family_relationships(senior_id, priority, relationship);
CREATE INDEX IF NOT EXISTS idx_family_interactions_senior_occurred
  ON family_interactions(senior_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_baselines_senior_metric
  ON guru_baselines(senior_id, metric_key, window_days);
CREATE INDEX IF NOT EXISTS idx_guru_trends_senior_metric
  ON guru_trends(senior_id, metric_key, window_days);
CREATE INDEX IF NOT EXISTS idx_guru_recommendations_senior_status
  ON guru_recommendations(senior_id, status, recommendation_date DESC);
CREATE INDEX IF NOT EXISTS idx_guru_explanations_senior_date
  ON guru_explanations(senior_id, explanation_date DESC);
