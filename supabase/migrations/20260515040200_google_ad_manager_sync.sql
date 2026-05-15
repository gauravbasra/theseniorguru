create table if not exists public.google_ad_units (
  id uuid primary key default gen_random_uuid(),
  placement_key text not null unique,
  ad_unit_code text not null,
  surface text not null,
  status text not null default 'blocked' check (status in ('ready', 'blocked')),
  sync_payload jsonb not null default '{}'::jsonb,
  blockers jsonb not null default '[]'::jsonb,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.google_ad_units enable row level security;

create index if not exists google_ad_units_status_idx
  on public.google_ad_units (status, updated_at desc);

create index if not exists google_ad_units_placement_idx
  on public.google_ad_units (placement_key);
