alter table public.review_requests
  add column if not exists delivery_provider text,
  add column if not exists delivery_payload jsonb not null default '{}'::jsonb;

create index if not exists review_requests_delivery_provider_idx
  on public.review_requests (delivery_provider, status, created_at desc);
