-- Row-level security policies for mobile multi-user data.
-- API code must set:
--   set_config('app.current_user_id', '<uuid>', true)
--   set_config('app.current_user_role', '<role>', true)
-- inside each transaction/request before running user-scoped SQL.

CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.current_user_role', true), '')
$$;

CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_user_role() IN ('admin', 'superadmin')
$$;

CREATE OR REPLACE FUNCTION app_user_resident_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(id) FROM residents WHERE user_id = app_current_user_id()
$$;

CREATE OR REPLACE FUNCTION app_trusted_resident_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(resident_id)
  FROM trusted_connections
  WHERE trusted_user_id = app_current_user_id()
    AND status = 'approved'
$$;

CREATE OR REPLACE FUNCTION app_user_business_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT array_agg(id) FROM businesses WHERE owner_user_id = app_current_user_id()
$$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE residents ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_inventory_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_refill_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE wearable_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_call_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_event_rsvps ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_or_admin ON users
  USING (id = app_current_user_id() OR app_is_admin());

CREATE POLICY sessions_self_or_admin ON sessions
  USING (user_id = app_current_user_id() OR app_is_admin());

CREATE POLICY residents_self_trusted_or_admin ON residents
  USING (user_id = app_current_user_id() OR id = ANY(app_trusted_resident_ids()) OR app_is_admin());

CREATE POLICY trusted_connections_participant_or_admin ON trusted_connections
  USING (trusted_user_id = app_current_user_id() OR resident_id = ANY(app_user_resident_ids()) OR app_is_admin());

CREATE POLICY medications_resident_or_admin ON medications
  USING (resident_id = ANY(app_user_resident_ids()) OR resident_id = ANY(app_trusted_resident_ids()) OR app_is_admin());

CREATE POLICY medication_events_resident_or_admin ON medication_inventory_events
  USING (resident_id = ANY(app_user_resident_ids()) OR resident_id = ANY(app_trusted_resident_ids()) OR app_is_admin());

CREATE POLICY medication_refills_resident_or_business_or_admin ON medication_refill_requests
  USING (resident_id = ANY(app_user_resident_ids()) OR business_id = ANY(app_user_business_ids()) OR app_is_admin());

CREATE POLICY health_consents_resident_or_admin ON health_consents
  USING (resident_id = ANY(app_user_resident_ids()) OR app_is_admin());

CREATE POLICY health_vitals_resident_trusted_or_admin ON health_vitals
  USING (resident_id = ANY(app_user_resident_ids()) OR resident_id = ANY(app_trusted_resident_ids()) OR app_is_admin());

CREATE POLICY wearable_devices_resident_trusted_or_admin ON wearable_devices
  USING (resident_id = ANY(app_user_resident_ids()) OR resident_id = ANY(app_trusted_resident_ids()) OR app_is_admin());

CREATE POLICY wearable_telemetry_resident_trusted_or_admin ON wearable_telemetry
  USING (resident_id = ANY(app_user_resident_ids()) OR resident_id = ANY(app_trusted_resident_ids()) OR app_is_admin());

CREATE POLICY wearable_connections_resident_or_admin ON wearable_connections
  USING (resident_id = ANY(app_user_resident_ids()) OR app_is_admin());

CREATE POLICY safety_telemetry_resident_trusted_or_admin ON safety_telemetry
  USING (resident_id = ANY(app_user_resident_ids()) OR resident_id = ANY(app_trusted_resident_ids()) OR app_is_admin());

CREATE POLICY safety_events_resident_trusted_or_admin ON safety_events
  USING (resident_id = ANY(app_user_resident_ids()) OR resident_id = ANY(app_trusted_resident_ids()) OR app_is_admin());

CREATE POLICY notifications_user_or_admin ON notifications
  USING (user_id = app_current_user_id() OR app_is_admin());

CREATE POLICY circle_messages_participant_or_admin ON circle_messages
  USING (resident_id = ANY(app_user_resident_ids()) OR trusted_user_id = app_current_user_id() OR app_is_admin());

CREATE POLICY circle_call_requests_participant_or_admin ON circle_call_requests
  USING (resident_id = ANY(app_user_resident_ids()) OR trusted_user_id = app_current_user_id() OR app_is_admin());

CREATE POLICY resident_messages_resident_or_admin ON resident_messages
  USING (resident_id = ANY(app_user_resident_ids()) OR app_is_admin());

CREATE POLICY community_posts_author_or_admin ON community_posts
  USING (author_user_id = app_current_user_id() OR app_is_admin());

CREATE POLICY community_event_rsvps_user_or_admin ON community_event_rsvps
  USING (user_id = app_current_user_id() OR app_is_admin());

CREATE POLICY businesses_owner_or_admin ON businesses
  USING (owner_user_id = app_current_user_id() OR app_is_admin());

CREATE POLICY services_business_or_public ON services
  USING (business_id = ANY(app_user_business_ids()) OR status = 'approved' OR app_is_admin());

CREATE POLICY leads_business_resident_or_admin ON leads
  USING (business_id = ANY(app_user_business_ids()) OR resident_id = ANY(app_user_resident_ids()) OR app_is_admin());

CREATE POLICY bookings_business_resident_or_admin ON bookings
  USING (business_id = ANY(app_user_business_ids()) OR resident_id = ANY(app_user_resident_ids()) OR app_is_admin());

CREATE POLICY identity_evidence_subject_or_admin ON identity_evidence
  USING (subject_account_id = app_current_user_id()::text OR app_is_admin());

CREATE POLICY audit_logs_admin_only ON audit_logs
  USING (app_is_admin());
