CREATE TABLE IF NOT EXISTS health_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_oauth',
  scopes TEXT[] NOT NULL DEFAULT '{}',
  credential_ref TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, source)
);

CREATE TABLE IF NOT EXISTS health_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  source TEXT NOT NULL,
  steps INT,
  calories INT,
  sleep_minutes INT,
  resting_heart_rate INT,
  heart_rate_avg INT,
  heart_rate_min INT,
  heart_rate_max INT,
  respiratory_rate INT,
  oxygen_saturation INT,
  hrv INT,
  medication_adherence_percent NUMERIC(5,2),
  mood_score INT,
  fall_detected BOOLEAN NOT NULL DEFAULT FALSE,
  isolation_minutes INT,
  mobility_minutes INT,
  manual_notes TEXT,
  raw JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, metric_date, source)
);

CREATE TABLE IF NOT EXISTS health_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL,
  wellness_score NUMERIC(5,2) NOT NULL,
  sleep_score NUMERIC(5,2) NOT NULL,
  activity_score NUMERIC(5,2) NOT NULL,
  heart_score NUMERIC(5,2) NOT NULL,
  medication_score NUMERIC(5,2) NOT NULL,
  mood_score NUMERIC(5,2) NOT NULL,
  risk_level safety_severity NOT NULL DEFAULT 'info',
  risk_reasons TEXT[] NOT NULL DEFAULT '{}',
  source TEXT NOT NULL DEFAULT 'health-intelligence',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, metric_date)
);

CREATE TABLE IF NOT EXISTS health_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  score_id UUID REFERENCES health_scores(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity safety_severity NOT NULL DEFAULT 'watch',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  source TEXT NOT NULL DEFAULT 'health-intelligence',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS health_sharing_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  grantee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  visibility TEXT[] NOT NULL DEFAULT '{}',
  can_view_trends BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_alerts BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_medication_adherence BOOLEAN NOT NULL DEFAULT TRUE,
  can_view_location_context BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, grantee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_health_sources_resident_source ON health_sources(resident_id, source);
CREATE INDEX IF NOT EXISTS idx_health_daily_metrics_senior_date ON health_daily_metrics(senior_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_scores_senior_date ON health_scores(senior_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_health_alerts_senior_status ON health_alerts(senior_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_sharing_permissions_grantee ON health_sharing_permissions(grantee_user_id, status);
