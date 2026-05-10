create table public.review_request_campaigns (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  name text not null,
  message text,
  channel text not null default 'email' check (channel in ('email', 'sms', 'manual')),
  status text not null default 'queued' check (status in ('draft', 'queued', 'sent', 'blocked_by_policy', 'completed_with_errors')),
  total_recipients integer not null default 0,
  queued_requests integer not null default 0,
  blocked_requests integer not null default 0,
  policy_decision text not null default 'approved',
  created_at timestamptz not null default now()
);

create index review_request_campaigns_provider_created_idx
  on public.review_request_campaigns (provider_id, created_at desc);

alter table public.review_requests
  add column if not exists campaign_id uuid references public.review_request_campaigns(id) on delete set null;

create index if not exists review_requests_campaign_idx
  on public.review_requests (campaign_id);

alter table public.review_request_campaigns enable row level security;
