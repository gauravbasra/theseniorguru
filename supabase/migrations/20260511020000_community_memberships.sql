create type public.community_member_role as enum (
  'senior',
  'family',
  'caregiver',
  'provider',
  'expert',
  'admin'
);

create table public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  user_key text not null,
  display_name text,
  email text,
  role public.community_member_role not null default 'family',
  status text not null default 'pending' check (status in ('pending', 'active', 'blocked', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (community_id, user_key)
);

create index community_memberships_community_status_idx
  on public.community_memberships (community_id, status, created_at desc);

create index community_memberships_user_idx
  on public.community_memberships (user_key, created_at desc);

alter table public.community_memberships enable row level security;

create policy "Public can read active community memberships"
  on public.community_memberships for select
  using (status = 'active');
