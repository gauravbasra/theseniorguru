-- Business web portal and superadmin operations foundation.
-- This migration is additive. Existing mobile onboarding tables remain the source of truth for
-- business identity, services, availability, service areas, and lead rules.

with ranked_business_accounts as (
  select
    id,
    business_account_id,
    row_number() over (
      partition by business_account_id
      order by updated_at desc nulls last, created_at desc nulls last, id desc
    ) as row_number
  from business_onboarding_profiles
  where business_account_id is not null
)
update business_onboarding_profiles profile
set
  business_account_id = profile.business_account_id || '-duplicate-' || left(profile.id::text, 8),
  updated_at = now()
from ranked_business_accounts ranked
where profile.id = ranked.id
  and ranked.row_number > 1;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'business_onboarding_profiles_business_account_id_key'
  ) then
    alter table business_onboarding_profiles
      add constraint business_onboarding_profiles_business_account_id_key unique (business_account_id);
  end if;
end $$;

create table if not exists business_portal_packages (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_onboarding_profiles(id) on delete cascade,
  package_code text not null check (package_code in ('free','growth_100')),
  status text not null default 'active' check (status in ('active','past_due','cancelled','trialing')),
  monthly_price_cents integer not null default 0,
  included_leads_per_period integer not null default 5,
  lead_period text not null default 'year' check (lead_period in ('month','year')),
  extra_lead_price_cents integer not null default 0,
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_profile_id)
);

create table if not exists business_documents (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_onboarding_profiles(id) on delete cascade,
  document_type text not null check (document_type in ('business_license','insurance','owner_id','driver_license','background_check','professional_license','w9','other')),
  file_name text not null,
  storage_url text not null,
  mime_type text,
  verification_status text not null default 'pending' check (verification_status in ('pending','approved','rejected','expired')),
  reviewer_notes text,
  uploaded_by_account_id text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists business_photos (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid not null references business_onboarding_profiles(id) on delete cascade,
  service_id uuid references business_service_catalog(id) on delete set null,
  photo_type text not null default 'gallery' check (photo_type in ('logo','owner','team','vehicle','service','license','gallery')),
  title text,
  storage_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','hidden')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists business_leads (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references business_onboarding_profiles(id) on delete set null,
  resident_id uuid references residents(id) on delete set null,
  request_type text not null,
  request_title text not null,
  request_details jsonb not null default '{}'::jsonb,
  pickup_geojson jsonb,
  dropoff_geojson jsonb,
  scheduled_for timestamptz,
  status text not null default 'new' check (status in ('new','viewed','quoted','accepted','declined','booked','in_progress','completed','cancelled','refunded')),
  estimated_value_cents integer,
  platform_fee_cents integer not null default 0,
  margin_cents integer not null default 0,
  source text not null default 'mobile_app',
  assigned_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_lead_status_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references business_leads(id) on delete cascade,
  old_status text,
  new_status text not null,
  actor_role text not null check (actor_role in ('business','superadmin','system','resident','trusted_circle')),
  actor_account_id text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists business_approval_queue (
  id uuid primary key default gen_random_uuid(),
  business_profile_id uuid references business_onboarding_profiles(id) on delete cascade,
  subject_type text not null check (subject_type in ('business_profile','service','photo','document','service_area','lead_rule')),
  subject_id uuid,
  status text not null default 'pending' check (status in ('pending','approved','rejected','needs_more_info')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  submitted_by_account_id text,
  reviewer_account_id text,
  reviewer_notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists partner_integrations (
  id uuid primary key default gen_random_uuid(),
  partner_key text not null unique,
  partner_name text not null,
  category text not null check (category in ('rides','meals','groceries','pharmacy','maps','payments','communications','health','other')),
  status text not null default 'credential_gated' check (status in ('credential_gated','sandbox','active','paused','disabled')),
  credential_status text not null default 'missing' check (credential_status in ('missing','configured','failed','rotating')),
  routing_priority integer not null default 100,
  config jsonb not null default '{}'::jsonb,
  last_health_check_at timestamptz,
  last_health_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists platform_usage_events (
  id uuid primary key default gen_random_uuid(),
  actor_account_id text,
  actor_role text not null default 'system',
  event_name text not null,
  surface text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_business_packages_profile on business_portal_packages(business_profile_id);
create index if not exists idx_business_documents_profile_status on business_documents(business_profile_id, verification_status);
create index if not exists idx_business_photos_profile_status on business_photos(business_profile_id, approval_status);
create index if not exists idx_business_leads_profile_status on business_leads(business_profile_id, status, created_at desc);
create index if not exists idx_business_lead_events_lead_created on business_lead_status_events(lead_id, created_at desc);
create index if not exists idx_business_approval_queue_status on business_approval_queue(status, priority, created_at);
create index if not exists idx_partner_integrations_category_status on partner_integrations(category, status);
create index if not exists idx_platform_usage_events_surface_created on platform_usage_events(surface, created_at desc);

insert into partner_integrations (partner_key, partner_name, category, status, credential_status, routing_priority)
values
  ('google_maps', 'Google Maps Platform', 'maps', 'active', 'configured', 10),
  ('stripe', 'Stripe Payments', 'payments', 'active', 'configured', 20),
  ('uber_health', 'Uber Health', 'rides', 'credential_gated', 'missing', 30),
  ('lyft_healthcare', 'Lyft Healthcare', 'rides', 'credential_gated', 'missing', 40),
  ('instacart', 'Instacart', 'groceries', 'credential_gated', 'missing', 50),
  ('grubhub', 'Grubhub', 'meals', 'credential_gated', 'missing', 60)
on conflict (partner_key) do update set
  partner_name = excluded.partner_name,
  category = excluded.category,
  routing_priority = excluded.routing_priority,
  updated_at = now();
