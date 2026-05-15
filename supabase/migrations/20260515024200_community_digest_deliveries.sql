create table public.community_digest_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_key text not null,
  topic_key text,
  city text,
  state text,
  delivery_provider text not null default 'manual_export'
    check (delivery_provider in ('manual_export', 'internal_notification_queue')),
  delivery_status text not null default 'queued'
    check (delivery_status in ('preview', 'queued', 'skipped')),
  feed_item_count integer not null default 0,
  recipient_device_count integer not null default 0,
  delivery_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index community_digest_deliveries_user_created_idx
  on public.community_digest_deliveries (user_key, created_at desc);

create index community_digest_deliveries_topic_scope_idx
  on public.community_digest_deliveries (topic_key, city, state, delivery_status, created_at desc);

alter table public.community_digest_deliveries enable row level security;

create policy "Public cannot read community digest delivery jobs"
  on public.community_digest_deliveries for select
  using (false);
