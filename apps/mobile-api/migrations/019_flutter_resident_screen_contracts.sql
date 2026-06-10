-- Flutter resident app screen contracts.
-- These indexes support the read/write paths surfaced by the resident Flutter UI.

CREATE TABLE IF NOT EXISTS community_event_rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'interested',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS resident_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  sender_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  recipient_key TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_medications_resident_status_time
  ON medications (resident_id, status, dose_time);

CREATE INDEX IF NOT EXISTS idx_bookings_resident_created
  ON bookings (resident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medication_refill_requests_resident_requested
  ON medication_refill_requests (resident_id, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_event_rsvps_resident_created
  ON community_event_rsvps (resident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_event_rsvps_user_created
  ON community_event_rsvps (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resident_messages_sender_created
  ON resident_messages (sender_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_resident_messages_resident_created
  ON resident_messages (resident_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_safety_events_resident_status_created
  ON safety_events (resident_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_vitals_resident_captured
  ON health_vitals (resident_id, captured_at DESC);
