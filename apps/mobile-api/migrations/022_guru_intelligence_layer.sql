-- Guru Intelligence Layer.
-- Daily metrics and daily risk scores that transform raw senior context into
-- status, explanations, recommendations, and next actions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE health_daily_metrics ADD COLUMN IF NOT EXISTS average_hr INT;
ALTER TABLE health_daily_metrics ADD COLUMN IF NOT EXISTS systolic_bp INT;
ALTER TABLE health_daily_metrics ADD COLUMN IF NOT EXISTS diastolic_bp INT;
ALTER TABLE health_daily_metrics ADD COLUMN IF NOT EXISTS weight_lbs NUMERIC;
ALTER TABLE health_daily_metrics ADD COLUMN IF NOT EXISTS glucose NUMERIC;
ALTER TABLE health_daily_metrics ADD COLUMN IF NOT EXISTS active_minutes INT;
ALTER TABLE health_daily_metrics ADD COLUMN IF NOT EXISTS source_type TEXT;

UPDATE health_daily_metrics SET source_type = source WHERE source_type IS NULL;

CREATE TABLE IF NOT EXISTS safe_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  resident_safe_zone_id UUID REFERENCES resident_safe_zones(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'OTHER',
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  radius_meters INT NOT NULL DEFAULT 150,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT current_date,
  distance_traveled_miles NUMERIC,
  safe_zone_visits INT NOT NULL DEFAULT 0,
  out_of_zone_minutes INT NOT NULL DEFAULT 0,
  home_time_minutes INT,
  community_time_minutes INT,
  doctor_visits INT NOT NULL DEFAULT 0,
  pharmacy_visits INT NOT NULL DEFAULT 0,
  no_movement_minutes INT NOT NULL DEFAULT 0,
  unusual_outside_safe_zone BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, metric_date)
);

CREATE TABLE IF NOT EXISTS environmental_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT current_date,
  aqi INT,
  pollen_level INT,
  uv_index INT,
  temperature_high NUMERIC,
  temperature_low NUMERIC,
  storm_risk INT,
  snow_risk INT,
  wildfire_risk INT,
  heat_risk INT,
  smoke_risk INT,
  humidity_percent INT,
  provider TEXT NOT NULL DEFAULT 'context_engine',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, metric_date)
);

CREATE TABLE IF NOT EXISTS social_daily_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  metric_date DATE NOT NULL DEFAULT current_date,
  messages_sent INT NOT NULL DEFAULT 0,
  messages_received INT NOT NULL DEFAULT 0,
  calls_completed INT NOT NULL DEFAULT 0,
  family_interactions INT NOT NULL DEFAULT 0,
  events_attended INT NOT NULL DEFAULT 0,
  guru_interactions INT NOT NULL DEFAULT 0,
  days_without_family_contact INT,
  days_without_social_interaction INT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, metric_date)
);

CREATE TABLE IF NOT EXISTS guru_risk_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  score_date DATE NOT NULL DEFAULT current_date,
  wellness_score INT NOT NULL DEFAULT 0,
  health_risk_score INT NOT NULL DEFAULT 0,
  mobility_risk_score INT NOT NULL DEFAULT 0,
  medication_risk_score INT NOT NULL DEFAULT 0,
  social_risk_score INT NOT NULL DEFAULT 0,
  environmental_risk_score INT NOT NULL DEFAULT 0,
  safety_risk_score INT NOT NULL DEFAULT 0,
  final_status TEXT NOT NULL DEFAULT 'STABLE',
  explanation JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_safe_zones_senior_status ON safe_zones(senior_id, status, type);
CREATE INDEX IF NOT EXISTS idx_location_daily_metrics_senior_date ON location_daily_metrics(senior_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_environmental_daily_metrics_senior_date ON environmental_daily_metrics(senior_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_daily_metrics_senior_date ON social_daily_metrics(senior_id, metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_guru_risk_scores_senior_date ON guru_risk_scores(senior_id, score_date DESC);
