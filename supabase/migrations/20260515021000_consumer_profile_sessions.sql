create table if not exists public.consumer_profiles (
  user_key text primary key,
  display_name text,
  email text,
  role text not null default 'family' check (role in ('senior', 'family', 'caregiver', 'advisor')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists consumer_profiles_email_idx on public.consumer_profiles (email);
create index if not exists consumer_profiles_last_seen_idx on public.consumer_profiles (last_seen_at desc);

alter table public.consumer_profiles enable row level security;
