create table if not exists public.external_review_integrations (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  source text not null check (source in ('google_business_profile', 'caring_com', 'facebook', 'a_place_for_mom')),
  status text not null default 'owner_action_required' check (
    status in ('not_connected', 'owner_action_required', 'credential_ready', 'sync_ready', 'sync_failed', 'disabled')
  ),
  sync_mode text not null default 'pending' check (sync_mode in ('manual_export', 'read_only_api', 'pending')),
  credential_reference text,
  last_sync_at timestamptz,
  last_sync_status text,
  review_count integer not null default 0 check (review_count >= 0),
  average_rating numeric(3,2) check (average_rating is null or (average_rating >= 0 and average_rating <= 5)),
  blockers text[] not null default array[]::text[],
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, source)
);

create index if not exists external_review_integrations_provider_status_idx
  on public.external_review_integrations (provider_id, status, source);

alter table public.external_review_integrations enable row level security;
