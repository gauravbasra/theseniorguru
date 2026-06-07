-- TheSeniorGuru role onboarding, identity evidence, health sharing, and service area rules.
-- Applies to PostgreSQL. Keep media binary objects in object storage; store metadata + signed URL references here.

create table if not exists onboarding_sessions (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('senior','trust_circle','business')),
  account_id text,
  status text not null default 'draft' check (status in ('draft','in_progress','submitted','complete','rejected')),
  current_step text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists identity_evidence (
  id uuid primary key default gen_random_uuid(),
  onboarding_session_id uuid references onboarding_sessions(id) on delete cascade,
  subject_role text not null check (subject_role in ('senior','trust_circle','business_owner','business_staff')),
  subject_account_id text,
  evidence_type text not null check (evidence_type in ('profile_photo','liveness_video','government_id','business_license','insurance','background_check','professional_license','driver_license')),
  storage_url text,
  thumbnail_url text,
  capture_method text not null default 'live_camera' check (capture_method in ('live_camera','upload','external_verification')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','failed','manual_review','expired')),
  verification_score numeric(5,2),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  expires_at timestamptz
);

create table if not exists senior_onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  onboarding_session_id uuid references onboarding_sessions(id) on delete cascade,
  senior_account_id text,
  full_name text not null,
  preferred_name text,
  phone text not null,
  email text,
  date_of_birth date,
  address_line text,
  community_name text,
  living_type text,
  preferred_language text default 'en',
  text_size_preference text default 'large',
  voice_preference text,
  emergency_access_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists senior_health_onboarding (
  id uuid primary key default gen_random_uuid(),
  senior_profile_id uuid references senior_onboarding_profiles(id) on delete cascade,
  health_concerns text[] not null default '{}',
  allergies text,
  mobility_notes text,
  cognitive_notes text,
  food_restrictions text,
  baseline_metrics jsonb not null default '{}'::jsonb,
  wearable_sources text[] not null default '{}',
  health_data_scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists device_permission_grants (
  id uuid primary key default gen_random_uuid(),
  onboarding_session_id uuid references onboarding_sessions(id) on delete cascade,
  account_id text,
  permission_name text not null check (permission_name in ('location','notifications','microphone','camera','contacts','calendar','photos','motion','health')),
  requested_reason text,
  grant_status text not null default 'not_requested' check (grant_status in ('not_requested','granted','denied','limited','revoked')),
  granted_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists music_connections (
  id uuid primary key default gen_random_uuid(),
  senior_profile_id uuid references senior_onboarding_profiles(id) on delete cascade,
  provider text not null check (provider in ('apple_music','spotify','youtube_music','amazon_music','local_device')),
  connection_status text not null default 'pending' check (connection_status in ('pending','connected','failed','revoked')),
  favorite_artists text[] not null default '{}',
  favorite_genres text[] not null default '{}',
  playlists jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trust_circle_onboarding (
  id uuid primary key default gen_random_uuid(),
  onboarding_session_id uuid references onboarding_sessions(id) on delete cascade,
  senior_account_id text,
  member_account_id text,
  full_name text not null,
  relationship text not null,
  phone text not null,
  email text,
  timezone text,
  role_type text check (role_type in ('family','friend','caregiver','community_staff','doctor','emergency_contact')),
  escalation_role text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists trust_circle_messaging_rules (
  id uuid primary key default gen_random_uuid(),
  trust_circle_member_id uuid references trust_circle_onboarding(id) on delete cascade,
  routine_window text,
  quiet_hours text,
  emergency_override boolean not null default true,
  alert_types text[] not null default '{}',
  preferred_channels text[] not null default '{app}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists health_visibility_permissions (
  id uuid primary key default gen_random_uuid(),
  senior_account_id text not null,
  viewer_account_id text not null,
  viewer_relationship text,
  permission_level text not null check (permission_level in ('none','emergency_only','care_partner','health_manager')),
  scopes text[] not null default '{}',
  granted_by_account_id text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  consent_record_id uuid,
  unique (senior_account_id, viewer_account_id)
);

create table if not exists business_onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  onboarding_session_id uuid references onboarding_sessions(id) on delete cascade,
  business_account_id text,
  business_type text not null,
  legal_name text not null,
  dba_name text,
  owner_name text not null,
  phone text not null,
  email text not null,
  website text,
  business_address text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','restricted','rejected')),
  trust_score numeric(5,2) default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_service_catalog (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references business_onboarding_profiles(id) on delete cascade,
  category text not null,
  service_name text not null,
  description text,
  price_min numeric(10,2),
  price_max numeric(10,2),
  price_unit text check (price_unit in ('fixed','hourly','per_mile','per_visit','subscription','custom')),
  cancellation_policy text,
  minimum_notice_minutes integer default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists business_availability_rules (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references business_onboarding_profiles(id) on delete cascade,
  day_of_week integer check (day_of_week between 0 and 6),
  open_time time,
  close_time time,
  same_day_available boolean not null default false,
  emergency_service boolean not null default false,
  capacity_per_day integer,
  blackout_dates date[] not null default '{}'
);

create table if not exists business_service_areas (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references business_onboarding_profiles(id) on delete cascade,
  service_radius_miles numeric(8,2),
  zip_codes text[] not null default '{}',
  cities text[] not null default '{}',
  boundary_geojson jsonb,
  excluded_areas_geojson jsonb,
  boundary_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists business_lead_rules (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references business_onboarding_profiles(id) on delete cascade,
  max_leads_per_day integer default 10,
  lead_types text[] not null default '{}',
  minimum_job_value numeric(10,2),
  accepts_urgent boolean not null default false,
  accepts_recurring boolean not null default true,
  languages_supported text[] not null default '{English}'::text[],
  communication_channels text[] not null default '{app}'::text[],
  response_sla_minutes integer default 60
);

create table if not exists consent_records (
  id uuid primary key default gen_random_uuid(),
  subject_account_id text,
  subject_role text not null,
  consent_scope text not null,
  consent_text text,
  granted boolean not null default true,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  source_ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_onboarding_sessions_role_status on onboarding_sessions(role, status);
create index if not exists idx_identity_evidence_subject on identity_evidence(subject_role, subject_account_id);
create index if not exists idx_health_visibility_viewer on health_visibility_permissions(viewer_account_id, permission_level);
create index if not exists idx_business_service_area_profile on business_service_areas(business_profile_id);
create index if not exists idx_business_service_catalog_category on business_service_catalog(category, active);
