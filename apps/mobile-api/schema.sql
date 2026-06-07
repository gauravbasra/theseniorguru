CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('senior', 'trusted_person', 'business', 'superadmin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE approval_status AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('free', 'growth_100');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'matched', 'accepted', 'booked', 'closed', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE safety_severity AS ENUM ('info', 'watch', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_severity AS ENUM ('info', 'warning', 'security', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  phone TEXT,
  display_name TEXT NOT NULL,
  role app_role NOT NULL,
  password_hash TEXT,
  status approval_status NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS residents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  age INT,
  community TEXT,
  mood TEXT,
  health_conditions TEXT[] NOT NULL DEFAULT '{}',
  allergies TEXT[] NOT NULL DEFAULT '{}',
  mobility_notes TEXT,
  cognitive_support TEXT,
  health_profile JSONB NOT NULL DEFAULT '{}',
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  live_tracking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  memory_support_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS trusted_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  trusted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  status approval_status NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (resident_id, trusted_user_id)
);

CREATE TABLE IF NOT EXISTS trusted_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  invite_token_hash TEXT NOT NULL UNIQUE,
  invited_email TEXT,
  invited_phone TEXT,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_by UUID REFERENCES users(id),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  trusted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS circle_call_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  trusted_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  website TEXT,
  google_business_profile TEXT,
  description TEXT,
  demographics TEXT[] NOT NULL DEFAULT '{}',
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  status approval_status NOT NULL DEFAULT 'draft',
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES users(id),
  status approval_status NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  plan subscription_plan NOT NULL DEFAULT 'free',
  billing_status TEXT NOT NULL DEFAULT 'active',
  lock_reason TEXT,
  locked_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  lead_top_ups INT NOT NULL DEFAULT 0,
  used_leads_month INT NOT NULL DEFAULT 0,
  used_leads_year INT NOT NULL DEFAULT 0,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  price_label TEXT,
  status approval_status NOT NULL DEFAULT 'pending_review',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ride_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'credential_required',
  supports_guest_rides BOOLEAN NOT NULL DEFAULT TRUE,
  supports_healthcare BOOLEAN NOT NULL DEFAULT TRUE,
  supported_regions TEXT[] NOT NULL DEFAULT '{}',
  credential_source TEXT,
  credential_status TEXT NOT NULL DEFAULT 'missing',
  payment_model TEXT NOT NULL DEFAULT 'senior_paid_platform_dispatch',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_order_provider_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'credential_required',
  supported_regions TEXT[] NOT NULL DEFAULT '{}',
  credential_source TEXT,
  credential_status TEXT NOT NULL DEFAULT 'missing',
  payment_model TEXT NOT NULL DEFAULT 'senior_paid_platform_dispatch',
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(category, provider)
);

CREATE TABLE IF NOT EXISTS support_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  provider TEXT NOT NULL,
  fulfillment_mode TEXT NOT NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'payment_required',
  label TEXT NOT NULL,
  delivery_label TEXT,
  delivery_lat NUMERIC,
  delivery_lng NUMERIC,
  provider_bill_cents INT NOT NULL,
  tax_cents INT NOT NULL DEFAULT 0,
  refund_reserve_cents INT NOT NULL DEFAULT 0,
  platform_margin_cents INT NOT NULL DEFAULT 0,
  total_charge_cents INT NOT NULL,
  payment_responsibility TEXT NOT NULL DEFAULT 'senior',
  payment_status TEXT NOT NULL DEFAULT 'payment_required',
  payer_user_id UUID REFERENCES users(id),
  payment_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  external_order_id TEXT,
  order_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  pricing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  business_id UUID REFERENCES businesses(id),
  request_type TEXT NOT NULL,
  requested_time TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id),
  service_id UUID REFERENCES services(id),
  scheduled_for TIMESTAMPTZ,
  label TEXT NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition TEXT,
  strength TEXT NOT NULL DEFAULT '',
  dose_quantity NUMERIC NOT NULL DEFAULT 1,
  dose_time TEXT NOT NULL,
  frequency TEXT NOT NULL DEFAULT 'Once daily',
  remaining_count INT NOT NULL DEFAULT 0,
  refill_threshold INT NOT NULL DEFAULT 5,
  prescriber TEXT,
  pharmacy TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  last_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resident_diagnoses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  condition_name TEXT NOT NULL,
  status TEXT NOT NULL,
  severity TEXT NOT NULL,
  diagnosed_when TEXT,
  symptoms_to_watch TEXT[] NOT NULL DEFAULT '{}',
  care_team_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resident_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  reaction TEXT,
  severity TEXT NOT NULL DEFAULT 'unknown',
  emergency_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resident_mobility_profiles (
  resident_id UUID PRIMARY KEY REFERENCES residents(id) ON DELETE CASCADE,
  assistive_device TEXT,
  fall_history TEXT,
  transfer_support TEXT NOT NULL,
  walking_tolerance TEXT,
  home_risk_areas TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resident_cognitive_support_profiles (
  resident_id UUID PRIMARY KEY REFERENCES residents(id) ON DELETE CASCADE,
  wandering_risk TEXT,
  confusion_triggers TEXT[] NOT NULL DEFAULT '{}',
  reassurance_style TEXT NOT NULL,
  routine_anchors TEXT[] NOT NULL DEFAULT '{}',
  preferred_hospital TEXT,
  emergency_instructions TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medication_inventory_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  quantity_delta NUMERIC NOT NULL DEFAULT 0,
  remaining_after NUMERIC NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS medication_refill_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medication_id UUID NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES users(id),
  acted_by UUID REFERENCES users(id),
  pharmacy_name TEXT,
  status TEXT NOT NULL DEFAULT 'requested',
  notes TEXT,
  response_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE residents ADD COLUMN IF NOT EXISTS health_conditions TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE residents ADD COLUMN IF NOT EXISTS allergies TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE residents ADD COLUMN IF NOT EXISTS mobility_notes TEXT;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS cognitive_support TEXT;
ALTER TABLE residents ADD COLUMN IF NOT EXISTS health_profile JSONB NOT NULL DEFAULT '{}';
ALTER TABLE medications ADD COLUMN IF NOT EXISTS strength TEXT NOT NULL DEFAULT '';
ALTER TABLE medications ADD COLUMN IF NOT EXISTS dose_quantity NUMERIC NOT NULL DEFAULT 1;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS frequency TEXT NOT NULL DEFAULT 'Once daily';
ALTER TABLE medications ADD COLUMN IF NOT EXISTS refill_threshold INT NOT NULL DEFAULT 5;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS prescriber TEXT;
ALTER TABLE medications ADD COLUMN IF NOT EXISTS pharmacy TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS lock_reason TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pickup_label TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dropoff_label TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dropoff_lat NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS dropoff_lng NUMERIC;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS distance_meters INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duration_seconds INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS route_provider TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS route_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_label TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_label TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_lat NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS dropoff_lng NUMERIC;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS distance_meters INT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS duration_seconds INT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS route_provider TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS route_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'requested';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fulfillment_provider TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS external_trip_id TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS fulfillment_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS lifecycle_status TEXT NOT NULL DEFAULT 'requested';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fulfillment_provider TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS external_trip_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS fulfillment_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_responsibility TEXT NOT NULL DEFAULT 'senior';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'payment_required';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payer_user_id UUID REFERENCES users(id);
ALTER TABLE leads ADD COLUMN IF NOT EXISTS payment_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_responsibility TEXT NOT NULL DEFAULT 'senior';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'payment_required';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payer_user_id UUID REFERENCES users(id);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS payment_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS provider_bill_cents INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tax_cents INT NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS refund_reserve_cents INT NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS platform_margin_cents INT NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS total_charge_cents INT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pricing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_bill_cents INT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS tax_cents INT NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS refund_reserve_cents INT NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS platform_margin_cents INT NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS total_charge_cents INT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE support_orders ADD COLUMN IF NOT EXISTS payment_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS safety_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  lat NUMERIC,
  lng NUMERIC,
  accuracy_meters INT,
  location_label TEXT,
  movement_status TEXT,
  steps_last_hour INT,
  still_minutes INT,
  last_known_speed_mph NUMERIC,
  phone_battery INT,
  fall_confidence NUMERIC,
  impact_detected BOOLEAN NOT NULL DEFAULT FALSE,
  safe_zone_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS resident_safe_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  center_lat NUMERIC NOT NULL,
  center_lng NUMERIC NOT NULL,
  radius_meters INT NOT NULL DEFAULT 150,
  status TEXT NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_resident_safe_zones_resident_status ON resident_safe_zones(resident_id, status);

CREATE TABLE IF NOT EXISTS safety_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  telemetry_id UUID REFERENCES safety_telemetry(id),
  event_type TEXT NOT NULL,
  severity safety_severity NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  notified_user_ids UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS health_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL UNIQUE REFERENCES residents(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT FALSE,
  source TEXT,
  data_types TEXT[] NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS health_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  heart_rate INT,
  oxygen_saturation INT,
  respiratory_rate INT,
  hrv INT,
  sleep_minutes INT,
  calories_today INT,
  steps_today INT,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wearable_devices (
  id TEXT PRIMARY KEY,
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  device_type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'connected',
  battery_percent INT,
  signal TEXT,
  last_seen_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wearable_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  device_id TEXT REFERENCES wearable_devices(id),
  fall_confidence NUMERIC NOT NULL DEFAULT 0,
  sos_pressed BOOLEAN NOT NULL DEFAULT FALSE,
  proximity_zone TEXT,
  proximity_distance_meters NUMERIC,
  proximity_safe BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES safety_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  provider_message_id TEXT,
  provider TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  retry_count INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS notification_delivery_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  provider_message_id TEXT,
  error TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID REFERENCES users(id),
  target_user_id UUID REFERENCES users(id),
  entity_type TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  severity audit_severity NOT NULL DEFAULT 'info',
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_telemetry_resident_created ON safety_telemetry(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_safety_events_resident_status ON safety_events(resident_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_business_status ON leads(business_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_services_business_status ON services(business_id, status);
CREATE INDEX IF NOT EXISTS idx_medications_resident_status ON medications(resident_id, status, dose_time);
CREATE INDEX IF NOT EXISTS idx_resident_diagnoses_resident ON resident_diagnoses(resident_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_allergies_resident ON resident_allergies(resident_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_medication_inventory_events_medication ON medication_inventory_events(medication_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_medication_refill_requests_resident ON medication_refill_requests(resident_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_medication_refill_requests_business ON medication_refill_requests(business_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_health_vitals_resident_created ON health_vitals(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_telemetry_resident_created ON wearable_telemetry(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_status_created ON notifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_attempts_notification ON notification_delivery_attempts(notification_id, attempted_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_messages_resident_created ON circle_messages(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_circle_call_requests_resident_status ON circle_call_requests(resident_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_orders_resident_category ON support_orders(resident_id, category, created_at DESC);


CREATE TABLE IF NOT EXISTS guru_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL,
  label TEXT,
  source TEXT,
  image_uri TEXT,
  file_name TEXT,
  width INT,
  height INT,
  analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
  matches JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'analyzed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_scans_resident_created ON guru_scans (resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_scans_type ON guru_scans (scan_type);

-- Guru Companion Phase 3: storytelling, music, memory graph, calendar/reminder foundation.
CREATE TABLE IF NOT EXISTS guru_memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'note',
  value TEXT NOT NULL,
  importance TEXT NOT NULL DEFAULT 'medium',
  source TEXT,
  visibility TEXT NOT NULL DEFAULT 'resident_and_trusted_circle',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT,
  source TEXT NOT NULL DEFAULT 'guru',
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_story_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  theme TEXT NOT NULL DEFAULT 'comfort',
  story TEXT NOT NULL,
  source TEXT,
  memory_ids UUID[] DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS guru_music_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'youtube',
  query TEXT NOT NULL,
  mood TEXT,
  url TEXT,
  source TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guru_memories_resident_category ON guru_memories(resident_id, category, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_calendar_events_resident_created ON guru_calendar_events(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_story_sessions_resident_created ON guru_story_sessions(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_guru_music_sessions_resident_created ON guru_music_sessions(resident_id, created_at DESC);

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

CREATE TABLE IF NOT EXISTS wearable_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  account_id TEXT,
  provider TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source TEXT NOT NULL,
  requested_data_types TEXT[] NOT NULL DEFAULT '{}',
  native_diagnostics JSONB NOT NULL DEFAULT '{}'::jsonb,
  connected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_community_event_rsvps_user_created ON community_event_rsvps(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resident_messages_resident_created ON resident_messages(resident_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wearable_connections_resident ON wearable_connections(resident_id, provider);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_entity ON audit_logs(created_at DESC, entity_type);
CREATE INDEX IF NOT EXISTS idx_notifications_user_status_created ON notifications(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_vitals_created_resident ON health_vitals(created_at DESC, resident_id);
CREATE INDEX IF NOT EXISTS idx_wearable_telemetry_created_resident ON wearable_telemetry(created_at DESC, resident_id);
CREATE INDEX IF NOT EXISTS idx_safety_telemetry_created_resident ON safety_telemetry(created_at DESC, resident_id);
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
-- Chunked identity evidence uploads for liveness videos.
-- Avoids sending large videos as a single JSON request body.

CREATE TABLE IF NOT EXISTS media_upload_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  identity_evidence_id UUID REFERENCES identity_evidence(id) ON DELETE CASCADE,
  subject_role TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  bucket TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  original_file_name TEXT,
  content_type TEXT NOT NULL,
  expected_byte_size BIGINT,
  total_chunks INT,
  received_chunks INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'receiving' CHECK (status IN ('receiving','completed','failed')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS media_upload_chunks (
  upload_session_id UUID NOT NULL REFERENCES media_upload_sessions(id) ON DELETE CASCADE,
  chunk_index INT NOT NULL,
  content BYTEA NOT NULL,
  byte_size INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (upload_session_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_media_upload_sessions_owner_created
  ON media_upload_sessions(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_media_upload_sessions_evidence
  ON media_upload_sessions(identity_evidence_id);

-- Social graph, viral invitations, and explicit trust-circle permissions.

ALTER TABLE trusted_connections
  ADD COLUMN IF NOT EXISTS connection_type TEXT NOT NULL DEFAULT 'family'
    CHECK (connection_type IN ('family','friend','caregiver')),
  ADD COLUMN IF NOT EXISTS health_access_status TEXT NOT NULL DEFAULT 'not_requested'
    CHECK (health_access_status IN ('not_requested','pending_senior_approval','approved','denied','revoked')),
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invite_channel TEXT,
  ADD COLUMN IF NOT EXISTS invite_message TEXT;

ALTER TABLE trusted_invites
  ADD COLUMN IF NOT EXISTS connection_type TEXT NOT NULL DEFAULT 'family'
    CHECK (connection_type IN ('family','friend','caregiver')),
  ADD COLUMN IF NOT EXISTS invited_name TEXT,
  ADD COLUMN IF NOT EXISTS invite_channel TEXT,
  ADD COLUMN IF NOT EXISTS invite_message TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS social_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  group_type TEXT NOT NULL DEFAULT 'community'
    CHECK (group_type IN ('family','friends','caregivers','community','activity')),
  visibility TEXT NOT NULL DEFAULT 'invite_only'
    CHECK (visibility IN ('private','invite_only','community')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES social_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member'
    CHECK (member_role IN ('owner','admin','member')),
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited','active','removed','left')),
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_feed_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_post_id UUID UNIQUE REFERENCES community_posts(id) ON DELETE CASCADE,
  group_id UUID REFERENCES social_groups(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  media_object_ids UUID[] NOT NULL DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'community'
    CHECK (visibility IN ('community','group','circle','private')),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','hidden','deleted')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_post_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  feed_post_id UUID REFERENCES social_feed_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL DEFAULT 'heart',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id, reaction_type),
  UNIQUE (feed_post_id, user_id, reaction_type)
);

CREATE TABLE IF NOT EXISTS social_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE,
  feed_post_id UUID REFERENCES social_feed_posts(id) ON DELETE CASCADE,
  parent_comment_id UUID REFERENCES social_post_comments(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published','hidden','deleted')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS imported_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_hash TEXT NOT NULL,
  display_name TEXT,
  phone TEXT,
  email TEXT,
  source TEXT NOT NULL DEFAULT 'phone_contacts',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_user_id, contact_hash)
);

CREATE TABLE IF NOT EXISTS social_invite_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invited_name TEXT,
  invited_phone TEXT,
  invited_email TEXT,
  connection_type TEXT NOT NULL CHECK (connection_type IN ('family','friend','caregiver')),
  invite_channel TEXT NOT NULL DEFAULT 'copy_link',
  invite_message TEXT NOT NULL,
  invite_token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','expired','revoked')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_groups_resident ON social_groups(resident_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_group_members_user ON social_group_members(user_id, status);
CREATE INDEX IF NOT EXISTS idx_social_feed_posts_group ON social_feed_posts(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_post_comments_post ON social_post_comments(post_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_social_post_reactions_post ON social_post_reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_imported_contacts_owner ON imported_contacts(owner_user_id, display_name);
CREATE INDEX IF NOT EXISTS idx_social_invite_events_inviter ON social_invite_events(inviter_user_id, created_at DESC);

-- Group governance: roles, member permissions, rules, and moderation controls.

ALTER TABLE social_groups
  ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{
    "posting": "members",
    "invites": "admins",
    "memberApproval": "admins",
    "commenting": "members",
    "visibility": "invite_only"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{
    "owner": ["manage_group","manage_rules","manage_roles","add_members","remove_members","post","comment","react","moderate_content"],
    "admin": ["add_members","remove_members","post","comment","react","moderate_content"],
    "moderator": ["post","comment","react","moderate_content"],
    "member": ["post","comment","react"]
  }'::jsonb;

ALTER TABLE social_group_members
  ADD COLUMN IF NOT EXISTS permissions TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS removed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ,
  DROP CONSTRAINT IF EXISTS social_group_members_member_role_check;

ALTER TABLE social_group_members
  ADD CONSTRAINT social_group_members_member_role_check
  CHECK (member_role IN ('owner','admin','moderator','member'));

CREATE TABLE IF NOT EXISTS social_group_rule_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES social_groups(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  before_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_state JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_group_rule_events_group_created
  ON social_group_rule_events(group_id, created_at DESC);

-- Feed editor, member preferences, media attachments, and business ad insertion.

ALTER TABLE social_feed_posts
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS post_type TEXT NOT NULL DEFAULT 'status'
    CHECK (post_type IN ('status','photo','question','announcement','activity')),
  ADD COLUMN IF NOT EXISTS target_connection_types TEXT[] NOT NULL DEFAULT '{family,friend,caregiver}'::text[],
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE community_posts
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS media_object_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_connection_types TEXT[] NOT NULL DEFAULT '{family,friend,caregiver}'::text[],
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS social_feed_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resident_id UUID REFERENCES residents(id) ON DELETE CASCADE,
  show_family BOOLEAN NOT NULL DEFAULT TRUE,
  show_friends BOOLEAN NOT NULL DEFAULT TRUE,
  show_caregivers BOOLEAN NOT NULL DEFAULT TRUE,
  show_community BOOLEAN NOT NULL DEFAULT TRUE,
  show_business_ads BOOLEAN NOT NULL DEFAULT TRUE,
  muted_group_ids UUID[] NOT NULL DEFAULT '{}',
  muted_user_ids UUID[] NOT NULL DEFAULT '{}',
  preferred_categories TEXT[] NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, resident_id)
);

CREATE TABLE IF NOT EXISTS business_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  image_media_object_id UUID REFERENCES media_objects(id) ON DELETE SET NULL,
  cta_label TEXT NOT NULL DEFAULT 'Learn more',
  cta_url TEXT,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  target_connection_types TEXT[] NOT NULL DEFAULT '{family,friend,caregiver}'::text[],
  target_communities TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'services',
  placement TEXT NOT NULL DEFAULT 'feed',
  frequency INTEGER NOT NULL DEFAULT 4,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('draft','pending_review','active','paused','rejected','archived')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_ad_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES business_ads(id) ON DELETE CASCADE,
  viewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resident_id UUID REFERENCES residents(id) ON DELETE SET NULL,
  feed_position INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_social_feed_preferences_user ON social_feed_preferences(user_id, resident_id);
CREATE INDEX IF NOT EXISTS idx_business_ads_status_category ON business_ads(status, category, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_ad_impressions_ad_created ON business_ad_impressions(ad_id, created_at DESC);
