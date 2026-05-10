create type public.care_circle_member_role as enum (
  'senior',
  'family',
  'caregiver',
  'advisor',
  'provider'
);

create table public.saved_providers (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  provider_id uuid not null references public.providers(id) on delete cascade,
  notes text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (user_key, provider_id)
);

create index saved_providers_user_created_idx on public.saved_providers (user_key, created_at desc);

create table public.care_circles (
  id uuid primary key default gen_random_uuid(),
  owner_user_key text not null,
  name text not null,
  city text,
  state text,
  goals jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index care_circles_owner_created_idx on public.care_circles (owner_user_key, created_at desc);

create table public.care_circle_members (
  id uuid primary key default gen_random_uuid(),
  care_circle_id uuid not null references public.care_circles(id) on delete cascade,
  display_name text not null,
  email text,
  role public.care_circle_member_role not null default 'family',
  invite_status text not null default 'pending' check (invite_status in ('pending', 'accepted', 'declined', 'removed')),
  created_at timestamptz not null default now()
);

create index care_circle_members_circle_idx on public.care_circle_members (care_circle_id);

alter table public.saved_providers enable row level security;
alter table public.care_circles enable row level security;
alter table public.care_circle_members enable row level security;
