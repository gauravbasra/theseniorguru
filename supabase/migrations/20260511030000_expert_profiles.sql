create table public.expert_profiles (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  display_name text not null,
  email text,
  organization text,
  title text,
  specialty text not null,
  city text,
  state text,
  bio text,
  website_url text,
  credential_summary text,
  evidence_urls text[] not null default '{}',
  status text not null default 'pending_review' check (status in ('pending_review', 'verified', 'rejected', 'suspended')),
  verification_payload jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expert_profiles_status_city_state_idx
  on public.expert_profiles (status, city, state, created_at desc);

create index expert_profiles_user_key_idx
  on public.expert_profiles (user_key, created_at desc);

alter table public.expert_profiles enable row level security;

create policy "Public can read verified expert profiles"
  on public.expert_profiles for select
  using (status = 'verified');
