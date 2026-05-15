create table if not exists public.app_device_registrations (
  id uuid primary key default gen_random_uuid(),
  user_key text not null references public.consumer_profiles(user_key) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  device_id text,
  push_token text not null,
  token_provider text not null check (token_provider in ('apns', 'fcm', 'web_push', 'expo')),
  app_version text,
  locale text,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_key, device_id),
  unique (user_key, push_token)
);

create index if not exists app_device_registrations_user_status_idx
  on public.app_device_registrations (user_key, status, updated_at desc);

alter table public.app_device_registrations enable row level security;
