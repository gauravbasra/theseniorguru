create table public.scheduled_worker_runs (
  id uuid primary key default gen_random_uuid(),
  worker_key text not null,
  status text not null check (status in ('succeeded', 'failed')),
  started_at timestamptz not null,
  finished_at timestamptz not null default now(),
  duration_ms integer not null default 0,
  summary jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index scheduled_worker_runs_worker_created_idx
  on public.scheduled_worker_runs (worker_key, created_at desc);

create index scheduled_worker_runs_status_created_idx
  on public.scheduled_worker_runs (status, created_at desc);

alter table public.scheduled_worker_runs enable row level security;
