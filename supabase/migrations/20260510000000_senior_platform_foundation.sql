create extension if not exists pg_trgm with schema extensions;

create type public.provider_status as enum (
  'imported',
  'verified_by_source',
  'claimed',
  'verified',
  'growth_partner',
  'suspended',
  'closed'
);

create type public.source_review_status as enum (
  'pending',
  'approved',
  'blocked',
  'needs_legal_review'
);

create type public.policy_decision_status as enum (
  'approved',
  'approved_with_disclosure',
  'needs_human_review',
  'needs_legal_review',
  'needs_expert_review',
  'blocked',
  'blocked_non_overridable'
);

create table public.provider_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  parent_id uuid references public.provider_categories(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status public.provider_status not null default 'imported',
  short_description text,
  phone text,
  website_url text,
  email text,
  claimed_at timestamptz,
  verified_at timestamptz,
  confidence_score numeric(4,3) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index providers_name_trgm_idx on public.providers using gin (name extensions.gin_trgm_ops);
create index providers_status_idx on public.providers (status);

create table public.provider_locations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  label text not null default 'Main',
  address_line1 text,
  address_line2 text,
  city text not null,
  state text not null,
  postal_code text,
  country text not null default 'US',
  latitude numeric(10,7),
  longitude numeric(10,7),
  phone text,
  created_at timestamptz not null default now()
);

create index provider_locations_city_state_idx on public.provider_locations (city, state);

create table public.provider_category_assignments (
  provider_id uuid not null references public.providers(id) on delete cascade,
  category_id uuid not null references public.provider_categories(id) on delete cascade,
  primary key (provider_id, category_id)
);

create table public.data_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null,
  base_url text,
  jurisdiction text,
  review_status public.source_review_status not null default 'pending',
  robots_status text,
  terms_notes text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.provider_source_records (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete cascade,
  data_source_id uuid references public.data_sources(id) on delete set null,
  source_url text,
  source_record_id text,
  raw_payload jsonb not null default '{}'::jsonb,
  extracted_fields jsonb not null default '{}'::jsonb,
  confidence_score numeric(4,3) not null default 0,
  fetched_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.policy_checks (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid,
  action_key text not null,
  input_payload jsonb not null default '{}'::jsonb,
  decision public.policy_decision_status not null,
  reasons jsonb not null default '[]'::jsonb,
  checked_at timestamptz not null default now(),
  created_by uuid
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_type text not null default 'system',
  event_type text not null,
  subject_type text,
  subject_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.provider_categories enable row level security;
alter table public.providers enable row level security;
alter table public.provider_locations enable row level security;
alter table public.provider_category_assignments enable row level security;
alter table public.data_sources enable row level security;
alter table public.provider_source_records enable row level security;
alter table public.policy_checks enable row level security;
alter table public.audit_events enable row level security;

create policy "Public can read active provider categories"
  on public.provider_categories for select
  using (true);

create policy "Public can read published providers"
  on public.providers for select
  using (status in ('verified_by_source', 'claimed', 'verified', 'growth_partner'));

create policy "Public can read published provider locations"
  on public.provider_locations for select
  using (
    exists (
      select 1 from public.providers p
      where p.id = provider_locations.provider_id
        and p.status in ('verified_by_source', 'claimed', 'verified', 'growth_partner')
    )
  );

create policy "Public can read published category assignments"
  on public.provider_category_assignments for select
  using (
    exists (
      select 1 from public.providers p
      where p.id = provider_category_assignments.provider_id
        and p.status in ('verified_by_source', 'claimed', 'verified', 'growth_partner')
    )
  );

