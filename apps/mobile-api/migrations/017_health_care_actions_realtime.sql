ALTER TABLE health_alerts ADD COLUMN IF NOT EXISTS confirmation_status TEXT NOT NULL DEFAULT 'pending_confirmation';
ALTER TABLE health_alerts ADD COLUMN IF NOT EXISTS signal_count INT NOT NULL DEFAULT 1;
ALTER TABLE health_alerts ADD COLUMN IF NOT EXISTS confidence NUMERIC(5,2) NOT NULL DEFAULT 0.50;
ALTER TABLE health_alerts ADD COLUMN IF NOT EXISTS suppressed_until TIMESTAMPTZ;
ALTER TABLE health_alerts ADD COLUMN IF NOT EXISTS last_signal_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE health_alerts ADD COLUMN IF NOT EXISTS action_required BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS health_care_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  alert_id UUID REFERENCES health_alerts(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  urgency safety_severity NOT NULL DEFAULT 'watch',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  recommended_for TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'open',
  false_alarm_guard JSONB NOT NULL DEFAULT '{}',
  assigned_user_id UUID REFERENCES users(id),
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_realtime_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  severity safety_severity NOT NULL DEFAULT 'info',
  source_table TEXT,
  source_id UUID,
  audience TEXT[] NOT NULL DEFAULT '{}',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_health_care_actions_senior_status ON health_care_actions(senior_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_care_actions_alert ON health_care_actions(alert_id);
CREATE INDEX IF NOT EXISTS idx_health_realtime_events_senior_created ON health_realtime_events(senior_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_realtime_events_source ON health_realtime_events(source_table, source_id);
