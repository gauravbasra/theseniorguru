-- Full resident app surface schema.
-- Covers every current resident page with durable state, history, logs, and interaction records.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS resident_app_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  device_installation_id TEXT,
  platform TEXT NOT NULL DEFAULT 'flutter',
  app_version TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS resident_screen_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  screen_key TEXT NOT NULL,
  state_version INT NOT NULL DEFAULT 1,
  state_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  source TEXT NOT NULL DEFAULT 'api',
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, screen_key, state_version)
);

CREATE TABLE IF NOT EXISTS resident_screen_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  app_session_id UUID REFERENCES resident_app_sessions(id) ON DELETE SET NULL,
  screen_key TEXT NOT NULL,
  element_key TEXT NOT NULL,
  interaction_type TEXT NOT NULL,
  interaction_label TEXT,
  value_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS resident_action_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  screen_key TEXT NOT NULL,
  action_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  status TEXT NOT NULL DEFAULT 'completed',
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS resident_page_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  screen_key TEXT NOT NULL,
  event_name TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  entity_type TEXT,
  entity_id UUID,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resident_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  topic TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  quiet_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  escalation_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, channel, topic)
);

CREATE TABLE IF NOT EXISTS resident_daily_status_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL DEFAULT current_date,
  stability_status TEXT NOT NULL DEFAULT 'stable',
  health_confidence_percent INT NOT NULL DEFAULT 0,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  guru_insight JSONB NOT NULL DEFAULT '{}'::jsonb,
  summary_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, snapshot_date)
);

CREATE TABLE IF NOT EXISTS wellness_score_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  score_date DATE NOT NULL DEFAULT current_date,
  range_key TEXT NOT NULL DEFAULT 'today',
  wellness_score INT NOT NULL,
  score_label TEXT NOT NULL,
  change_from_prior INT NOT NULL DEFAULT 0,
  confidence_percent INT NOT NULL DEFAULT 0,
  source_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, score_date, range_key)
);

CREATE TABLE IF NOT EXISTS wellness_contributor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wellness_score_id UUID REFERENCES wellness_score_snapshots(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  contributor_key TEXT NOT NULL,
  label TEXT NOT NULL,
  status_label TEXT NOT NULL,
  contribution_points INT NOT NULL DEFAULT 0,
  trend TEXT NOT NULL DEFAULT 'helping',
  display_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vital_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  vital_key TEXT NOT NULL,
  unit TEXT NOT NULL,
  baseline_value NUMERIC,
  min_normal NUMERIC,
  max_normal NUMERIC,
  baseline_window_days INT NOT NULL DEFAULT 30,
  source TEXT NOT NULL DEFAULT 'computed',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, vital_key)
);

CREATE TABLE IF NOT EXISTS vital_monitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  vital_key TEXT NOT NULL,
  label TEXT NOT NULL,
  value_text TEXT NOT NULL,
  numeric_value NUMERIC,
  secondary_value NUMERIC,
  unit TEXT NOT NULL,
  status_label TEXT NOT NULL DEFAULT 'normal',
  baseline_text TEXT,
  color_band_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  trend_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS family_health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  snapshot_date DATE NOT NULL DEFAULT current_date,
  stability_status TEXT NOT NULL DEFAULT 'stable',
  health_confidence_percent INT NOT NULL DEFAULT 0,
  summary_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  changed_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  recommended_action JSONB NOT NULL DEFAULT '{}'::jsonb,
  guru_note TEXT,
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  range_key TEXT NOT NULL DEFAULT 'today',
  overall_level TEXT NOT NULL DEFAULT 'low',
  urgency_label TEXT NOT NULL DEFAULT 'No urgent concerns',
  risk_score INT NOT NULL DEFAULT 0,
  contributing_factors JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  model_version TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS risk_timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  risk_assessment_id UUID REFERENCES risk_assessments(id) ON DELETE SET NULL,
  event_date DATE NOT NULL DEFAULT current_date,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'normal',
  source_entity_type TEXT,
  source_entity_id UUID,
  display_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resident_service_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  match_score NUMERIC,
  rating NUMERIC,
  price_summary TEXT,
  availability_label TEXT,
  match_reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transportation_match_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  service_match_id UUID REFERENCES resident_service_matches(id) ON DELETE SET NULL,
  provider_name TEXT NOT NULL,
  rating NUMERIC,
  price_min_cents INT,
  price_max_cents INT,
  availability_label TEXT,
  vehicle_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  accessibility_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'available',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS booking_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  delivery_status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS support_order_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  support_order_id UUID NOT NULL REFERENCES support_orders(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS community_events (
  id TEXT PRIMARY KEY,
  community TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'activity',
  location_label TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  capacity INT,
  going_count INT NOT NULL DEFAULT 0,
  image_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'published',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS community_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS community_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS companion_mood_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  mood_label TEXT NOT NULL,
  mood_score INT,
  prompt_text TEXT,
  response_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS companion_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS companion_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES companion_conversations(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  body TEXT NOT NULL,
  sentiment_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS trusted_circle_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  trusted_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  source_entity_type TEXT,
  source_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_resident_app_sessions_resident_last_seen ON resident_app_sessions(resident_id, last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_screen_states_resident_screen ON resident_screen_states(resident_id, screen_key, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_screen_interactions_resident_time ON resident_screen_interactions(resident_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_screen_interactions_screen_time ON resident_screen_interactions(screen_key, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_action_history_resident_time ON resident_action_history(resident_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_page_audit_events_resident_created ON resident_page_audit_events(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_daily_status_snapshots_resident_date ON resident_daily_status_snapshots(resident_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_score_snapshots_resident_date ON wellness_score_snapshots(resident_id, score_date DESC);
CREATE INDEX IF NOT EXISTS idx_wellness_contributor_snapshots_resident ON wellness_contributor_snapshots(resident_id, contributor_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vital_baselines_resident_vital ON vital_baselines(resident_id, vital_key);
CREATE INDEX IF NOT EXISTS idx_vital_monitor_snapshots_resident_vital ON vital_monitor_snapshots(resident_id, vital_key, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_family_health_snapshots_resident_date ON family_health_snapshots(resident_id, snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_risk_assessments_resident_time ON risk_assessments(resident_id, assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_timeline_events_resident_date ON risk_timeline_events(resident_id, event_date DESC, display_order);
CREATE INDEX IF NOT EXISTS idx_resident_service_matches_resident_category ON resident_service_matches(resident_id, category, status);
CREATE INDEX IF NOT EXISTS idx_transportation_match_options_resident_created ON transportation_match_options(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_status_events_booking_time ON booking_status_events(booking_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_messages_booking_created ON booking_messages(booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_order_status_events_order_time ON support_order_status_events(support_order_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_events_community_start ON community_events(community, starts_at);
CREATE INDEX IF NOT EXISTS idx_community_post_comments_post_created ON community_post_comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_post_reactions_post ON community_post_reactions(post_id, reaction_type);
CREATE INDEX IF NOT EXISTS idx_companion_mood_checkins_resident_created ON companion_mood_checkins(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_conversations_resident_started ON companion_conversations(resident_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_messages_conversation_created ON companion_messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_trusted_circle_activity_resident_created ON trusted_circle_activity(resident_id, created_at DESC);
