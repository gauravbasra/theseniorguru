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
