create table if not exists public.content_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('article', 'newsletter', 'derivative')),
  subject_id text not null,
  channel text not null default 'owned_site',
  metric_key text not null check (metric_key in ('view', 'click', 'share', 'save', 'newsletter_open', 'newsletter_click', 'lead')),
  metric_value numeric not null default 1 check (metric_value > 0),
  metric_payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.content_performance_metrics enable row level security;

create index if not exists content_performance_metrics_subject_idx
  on public.content_performance_metrics (subject_type, subject_id, recorded_at desc);

create index if not exists content_performance_metrics_channel_idx
  on public.content_performance_metrics (channel, metric_key, recorded_at desc);
