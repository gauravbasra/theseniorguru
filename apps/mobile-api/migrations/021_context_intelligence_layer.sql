-- Context Intelligence layer for Guru.
-- Adds environment, location, routine, mobility, social, transportation, and context-risk inputs.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS resident_places (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  place_key TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  lat NUMERIC,
  lng NUMERIC,
  address TEXT,
  radius_meters INT NOT NULL DEFAULT 150,
  safe_zone_id UUID REFERENCES resident_safe_zones(id) ON DELETE SET NULL,
  is_safe_zone BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'resident_profile',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, place_key)
);

CREATE TABLE IF NOT EXISTS resident_location_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  place_id UUID REFERENCES resident_places(id) ON DELETE SET NULL,
  lat NUMERIC,
  lng NUMERIC,
  location_label TEXT,
  movement_status TEXT,
  safe_zone_status TEXT,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL DEFAULT 'mobile',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS resident_place_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  place_id UUID REFERENCES resident_places(id) ON DELETE SET NULL,
  visit_started_at TIMESTAMPTZ NOT NULL,
  visit_ended_at TIMESTAMPTZ,
  duration_minutes INT,
  visit_status TEXT NOT NULL DEFAULT 'completed',
  source TEXT NOT NULL DEFAULT 'location_timeline',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS resident_routines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  routine_key TEXT NOT NULL,
  title TEXT NOT NULL,
  routine_type TEXT NOT NULL,
  place_id UUID REFERENCES resident_places(id) ON DELETE SET NULL,
  expected_days INT[] NOT NULL DEFAULT '{}',
  expected_time_window JSONB NOT NULL DEFAULT '{}'::jsonb,
  expected_frequency_days INT,
  last_observed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, routine_key)
);

CREATE TABLE IF NOT EXISTS environment_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  place_id UUID REFERENCES resident_places(id) ON DELETE SET NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT NOT NULL DEFAULT 'manual',
  weather_condition TEXT,
  temperature_f NUMERIC,
  feels_like_f NUMERIC,
  humidity_percent INT,
  precipitation_probability_percent INT,
  snow_probability_percent INT,
  wind_mph NUMERIC,
  uv_index NUMERIC,
  aqi INT,
  aqi_category TEXT,
  pollen_tree_level TEXT,
  pollen_grass_level TEXT,
  pollen_weed_level TEXT,
  ozone_level TEXT,
  smoke_risk TEXT,
  wildfire_risk TEXT,
  heat_risk TEXT,
  ice_risk TEXT,
  storm_risk TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS environment_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  environment_observation_id UUID REFERENCES environment_observations(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  source TEXT NOT NULL DEFAULT 'context_engine',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mobility_context_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT current_date,
  steps_today INT,
  steps_baseline INT,
  steps_delta_percent NUMERIC,
  walking_speed_mps NUMERIC,
  distance_meters INT,
  community_visits INT,
  outside_home_minutes INT,
  weather_adjusted BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'normal',
  reasons TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS social_contact_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT current_date,
  last_family_contact_at TIMESTAMPTZ,
  days_since_family_contact INT,
  trusted_circle_touch_count INT NOT NULL DEFAULT 0,
  community_interaction_count INT NOT NULL DEFAULT 0,
  isolation_risk TEXT NOT NULL DEFAULT 'low',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS transportation_context_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  appointment_label TEXT,
  scheduled_for TIMESTAMPTZ,
  weather_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  route_context JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommendation TEXT NOT NULL,
  recommended_pickup_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'suggested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS guru_context_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  signal_date DATE NOT NULL DEFAULT current_date,
  domain TEXT NOT NULL,
  signal_key TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source_table TEXT,
  source_id UUID,
  suppressed BOOLEAN NOT NULL DEFAULT false,
  suppression_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_daily_guidance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  guidance_date DATE NOT NULL DEFAULT current_date,
  daily_status TEXT NOT NULL DEFAULT 'stable',
  health_risk TEXT NOT NULL DEFAULT 'low',
  environmental_risk TEXT NOT NULL DEFAULT 'low',
  mobility_risk TEXT NOT NULL DEFAULT 'low',
  isolation_risk TEXT NOT NULL DEFAULT 'low',
  medication_risk TEXT NOT NULL DEFAULT 'low',
  safety_risk TEXT NOT NULL DEFAULT 'low',
  guidance_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT NOT NULL DEFAULT '',
  calculated_from JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, guidance_date)
);

CREATE INDEX IF NOT EXISTS idx_resident_places_resident_category ON resident_places(resident_id, category);
CREATE INDEX IF NOT EXISTS idx_resident_location_timeline_resident_observed ON resident_location_timeline(resident_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_place_visits_resident_place_started ON resident_place_visits(resident_id, place_id, visit_started_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_routines_resident_status ON resident_routines(resident_id, status, routine_type);
CREATE INDEX IF NOT EXISTS idx_environment_observations_resident_observed ON environment_observations(resident_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_environment_alerts_resident_status ON environment_alerts(resident_id, status, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobility_context_snapshots_resident_date ON mobility_context_snapshots(resident_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_social_contact_snapshots_resident_date ON social_contact_snapshots(resident_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_transportation_context_decisions_resident_created ON transportation_context_decisions(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_context_signals_resident_date_domain ON guru_context_signals(resident_id, signal_date DESC, domain);
CREATE INDEX IF NOT EXISTS idx_guru_daily_guidance_resident_date ON guru_daily_guidance(resident_id, guidance_date DESC);
