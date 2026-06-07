-- Native health, maps, and service connector readiness.
-- Keeps third-party APIs credential-gated unless real partner keys are installed.

CREATE TABLE IF NOT EXISTS third_party_service_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  provider_type TEXT NOT NULL DEFAULT 'api',
  status TEXT NOT NULL DEFAULT 'credential_required'
    CHECK (status IN ('enabled','credential_required','sandbox','disabled','manual_fallback')),
  credential_env_keys TEXT[] NOT NULL DEFAULT '{}'::text[],
  open_api_docs_url TEXT,
  supports_direct_dispatch BOOLEAN NOT NULL DEFAULT false,
  supports_price_quote BOOLEAN NOT NULL DEFAULT false,
  supports_tracking BOOLEAN NOT NULL DEFAULT false,
  safety_review_required BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_health_check_at TIMESTAMPTZ,
  last_health_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_request_intake_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  optional_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  safety_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_provider TEXT NOT NULL DEFAULT 'manual_coordination',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_request_provider_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  connector_key TEXT NOT NULL REFERENCES third_party_service_connectors(connector_key) ON DELETE CASCADE,
  route_priority INT NOT NULL DEFAULT 100,
  availability_status TEXT NOT NULL DEFAULT 'credential_required'
    CHECK (availability_status IN ('available','credential_required','manual_fallback','disabled')),
  fallback_connector_key TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (category, connector_key)
);

CREATE INDEX IF NOT EXISTS idx_third_party_service_connectors_category_status
  ON third_party_service_connectors(category, status, provider_type);

CREATE INDEX IF NOT EXISTS idx_service_request_provider_routes_category_priority
  ON service_request_provider_routes(category, availability_status, route_priority);

INSERT INTO third_party_service_connectors (
  connector_key, display_name, category, provider_type, status, credential_env_keys,
  open_api_docs_url, supports_direct_dispatch, supports_price_quote, supports_tracking,
  safety_review_required, metadata
)
VALUES
  ('google_maps', 'Google Maps Platform', 'maps', 'api', 'enabled', ARRAY['GOOGLE_MAPS_API_KEY'], 'https://developers.google.com/maps', false, false, false, false, '{"installedInFlutter": true}'::jsonb),
  ('google_places', 'Google Places API', 'maps', 'api', 'enabled', ARRAY['GOOGLE_MAPS_API_KEY'], 'https://developers.google.com/maps/documentation/places/web-service', false, false, false, false, '{"usedFor": ["safe_zones","nearby_services","outdoor_recommendations"]}'::jsonb),
  ('apple_healthkit', 'Apple HealthKit', 'health', 'native_sdk', 'enabled', ARRAY[]::text[], 'https://developer.apple.com/documentation/healthkit', false, false, false, true, '{"installedInFlutter": true}'::jsonb),
  ('android_health_connect', 'Android Health Connect', 'health', 'native_sdk', 'enabled', ARRAY[]::text[], 'https://developer.android.com/health-and-fitness/guides/health-connect', false, false, false, true, '{"installedInFlutter": true}'::jsonb),
  ('uber_health', 'Uber Health', 'ride', 'api', 'credential_required', ARRAY['UBER_HEALTH_CLIENT_ID','UBER_HEALTH_CLIENT_SECRET'], 'https://developer.uber.com/docs/health', true, true, true, true, '{}'::jsonb),
  ('lyft_healthcare', 'Lyft Healthcare', 'ride', 'api', 'credential_required', ARRAY['LYFT_HEALTHCARE_CLIENT_ID','LYFT_HEALTHCARE_CLIENT_SECRET'], 'https://developer.lyft.com', true, true, true, true, '{}'::jsonb),
  ('doordash_drive', 'DoorDash Drive', 'food', 'api', 'credential_required', ARRAY['DOORDASH_DRIVE_CLIENT_ID','DOORDASH_DRIVE_CLIENT_SECRET'], 'https://developer.doordash.com', true, true, true, true, '{}'::jsonb),
  ('uber_eats', 'Uber Eats', 'food', 'api', 'credential_required', ARRAY['UBER_EATS_CLIENT_ID','UBER_EATS_CLIENT_SECRET'], 'https://developer.uber.com/docs/eats', true, true, true, true, '{}'::jsonb),
  ('grubhub', 'Grubhub', 'food', 'api', 'credential_required', ARRAY['GRUBHUB_CLIENT_ID','GRUBHUB_CLIENT_SECRET'], NULL, true, true, true, true, '{}'::jsonb),
  ('instacart', 'Instacart', 'grocery', 'api', 'credential_required', ARRAY['INSTACART_CLIENT_ID','INSTACART_CLIENT_SECRET'], 'https://docs.instacart.com', true, true, true, true, '{}'::jsonb),
  ('walmart', 'Walmart', 'grocery', 'api', 'credential_required', ARRAY['WALMART_CLIENT_ID','WALMART_CLIENT_SECRET'], 'https://developer.walmart.com', true, true, true, true, '{}'::jsonb),
  ('taskrabbit', 'Taskrabbit', 'handyman', 'api', 'credential_required', ARRAY['TASKRABBIT_CLIENT_ID','TASKRABBIT_CLIENT_SECRET'], NULL, true, true, true, true, '{}'::jsonb),
  ('angi', 'Angi Services', 'handyman', 'api', 'credential_required', ARRAY['ANGI_CLIENT_ID','ANGI_CLIENT_SECRET'], NULL, true, true, true, true, '{}'::jsonb),
  ('local_partner', 'Approved Local Partner Network', 'all', 'internal_network', 'enabled', ARRAY[]::text[], NULL, false, true, false, true, '{}'::jsonb),
  ('manual_coordination', 'Care Team Manual Coordination', 'all', 'manual', 'manual_fallback', ARRAY[]::text[], NULL, false, false, false, true, '{}'::jsonb)
ON CONFLICT (connector_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  category = EXCLUDED.category,
  provider_type = EXCLUDED.provider_type,
  status = CASE
    WHEN third_party_service_connectors.status IN ('enabled','sandbox','disabled') THEN third_party_service_connectors.status
    ELSE EXCLUDED.status
  END,
  credential_env_keys = EXCLUDED.credential_env_keys,
  open_api_docs_url = EXCLUDED.open_api_docs_url,
  supports_direct_dispatch = EXCLUDED.supports_direct_dispatch,
  supports_price_quote = EXCLUDED.supports_price_quote,
  supports_tracking = EXCLUDED.supports_tracking,
  safety_review_required = EXCLUDED.safety_review_required,
  metadata = third_party_service_connectors.metadata || EXCLUDED.metadata,
  updated_at = now();

INSERT INTO service_request_intake_templates (
  category, display_name, required_fields, optional_fields, safety_fields, default_provider
)
VALUES
  ('ride', 'Ride request', '["pickup","dropoff","scheduledFor","riderName","riderPhone"]', '["mobilityAid","accessibilityNeeds","caregiverRidingAlong","pickupInstructions","dropoffInstructions"]', '["okToShareWithDriver","medicalSensitivityNotes","emergencyContact"]', 'manual_coordination'),
  ('food', 'Food request', '["deliveryAddress","recipientName","recipientPhone","requestedWindow"]', '["dietaryNeeds","mealPreference","budget"]', '["allergies","swallowingRisk","contactAfterDelivery"]', 'manual_coordination'),
  ('grocery', 'Grocery request', '["deliveryAddress","recipientName","recipientPhone","items"]', '["substitutionsAllowed","budget","preferredStore"]', '["allergies","heavyItems","contactAfterDelivery"]', 'manual_coordination'),
  ('pharmacy', 'Pharmacy request', '["pharmacy","medicationName","deliveryAddress","recipientPhone"]', '["rxNumber","prescriber","preferredWindow"]', '["hipaaConsent","okToShareWithPharmacy","caregiverNotification"]', 'local_partner'),
  ('cleaning', 'Cleaning request', '["address","requestedWindow","contactPhone"]', '["rooms","tasks","pets","accessInstructions"]', '["safeEntryInstructions","residentPresent","caregiverNotification"]', 'local_partner'),
  ('handyman', 'Handyman request', '["address","taskDescription","requestedWindow","contactPhone"]', '["photos","toolsLikelyNeeded","budget"]', '["fallRiskArea","safeEntryInstructions","residentPresent","caregiverNotification"]', 'local_partner'),
  ('home_care', 'Home care request', '["address","supportNeed","requestedWindow","contactPhone"]', '["duration","caregiverPreference","mobilityNeeds"]', '["nonMedicalOnly","caregiverNotification","emergencyContact"]', 'local_partner'),
  ('essentials', 'Essentials request', '["deliveryAddress","recipientName","recipientPhone","items"]', '["budget","preferredStore","substitutionsAllowed"]', '["contactAfterDelivery","caregiverNotification"]', 'manual_coordination')
ON CONFLICT (category) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  required_fields = EXCLUDED.required_fields,
  optional_fields = EXCLUDED.optional_fields,
  safety_fields = EXCLUDED.safety_fields,
  default_provider = EXCLUDED.default_provider,
  updated_at = now();

INSERT INTO service_request_provider_routes (category, connector_key, route_priority, availability_status, fallback_connector_key)
VALUES
  ('ride', 'uber_health', 10, 'credential_required', 'manual_coordination'),
  ('ride', 'lyft_healthcare', 20, 'credential_required', 'manual_coordination'),
  ('ride', 'local_partner', 30, 'available', 'manual_coordination'),
  ('food', 'doordash_drive', 10, 'credential_required', 'manual_coordination'),
  ('food', 'uber_eats', 20, 'credential_required', 'manual_coordination'),
  ('food', 'grubhub', 30, 'credential_required', 'manual_coordination'),
  ('food', 'local_partner', 40, 'available', 'manual_coordination'),
  ('grocery', 'instacart', 10, 'credential_required', 'manual_coordination'),
  ('grocery', 'walmart', 20, 'credential_required', 'manual_coordination'),
  ('grocery', 'local_partner', 30, 'available', 'manual_coordination'),
  ('pharmacy', 'local_partner', 10, 'available', 'manual_coordination'),
  ('cleaning', 'local_partner', 10, 'available', 'manual_coordination'),
  ('handyman', 'taskrabbit', 10, 'credential_required', 'local_partner'),
  ('handyman', 'angi', 20, 'credential_required', 'local_partner'),
  ('handyman', 'local_partner', 30, 'available', 'manual_coordination'),
  ('home_care', 'local_partner', 10, 'available', 'manual_coordination'),
  ('essentials', 'local_partner', 10, 'available', 'manual_coordination')
ON CONFLICT (category, connector_key) DO UPDATE SET
  route_priority = EXCLUDED.route_priority,
  availability_status = EXCLUDED.availability_status,
  fallback_connector_key = EXCLUDED.fallback_connector_key,
  updated_at = now();

DO $$
BEGIN
  IF to_regclass('public.support_order_provider_configs') IS NOT NULL THEN
    INSERT INTO support_order_provider_configs (category, provider, display_name, status, credential_source, credential_status, notes, metadata)
    VALUES
      ('cleaning', 'local_partner', 'Approved cleaning partner', 'enabled', 'approved_business_network', 'configured', 'Approved home cleaning partner fallback.', '{"seededBy": "026_native_health_maps_service_connectors"}'::jsonb),
      ('handyman', 'taskrabbit', 'Taskrabbit', 'credential_required', 'TASKRABBIT_CLIENT_ID/TASKRABBIT_CLIENT_SECRET', 'missing', 'Partner/API access required for handyman tasks.', '{"seededBy": "026_native_health_maps_service_connectors"}'::jsonb),
      ('handyman', 'angi', 'Angi Services', 'credential_required', 'ANGI_CLIENT_ID/ANGI_CLIENT_SECRET', 'missing', 'Partner/API access required for home service tasks.', '{"seededBy": "026_native_health_maps_service_connectors"}'::jsonb),
      ('handyman', 'local_partner', 'Approved handyman partner', 'enabled', 'approved_business_network', 'configured', 'Approved local handyman fallback.', '{"seededBy": "026_native_health_maps_service_connectors"}'::jsonb),
      ('home_care', 'local_partner', 'Approved home care partner', 'enabled', 'approved_business_network', 'configured', 'Approved non-medical home care fallback.', '{"seededBy": "026_native_health_maps_service_connectors"}'::jsonb),
      ('essentials', 'local_partner', 'Approved essentials partner', 'enabled', 'approved_business_network', 'configured', 'Approved essentials fallback.', '{"seededBy": "026_native_health_maps_service_connectors"}'::jsonb)
    ON CONFLICT (category, provider) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      status = CASE
        WHEN support_order_provider_configs.status IN ('enabled','disabled') THEN support_order_provider_configs.status
        ELSE EXCLUDED.status
      END,
      credential_source = EXCLUDED.credential_source,
      credential_status = EXCLUDED.credential_status,
      notes = EXCLUDED.notes,
      metadata = support_order_provider_configs.metadata || EXCLUDED.metadata,
      updated_at = now();
  END IF;
END $$;
