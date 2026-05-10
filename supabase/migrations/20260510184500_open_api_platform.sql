create table public.api_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_type text not null default 'partner' check (owner_type in ('provider', 'partner', 'admin')),
  owner_id text,
  scopes text[] not null default array['providers:read', 'events:read'],
  sandbox_mode boolean not null default true,
  rate_limit_per_minute integer not null default 60 check (rate_limit_per_minute > 0),
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index api_clients_owner_idx on public.api_clients (owner_type, owner_id);

create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  api_client_id uuid not null references public.api_clients(id) on delete cascade,
  name text not null,
  key_hash text not null unique,
  key_preview text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index api_keys_client_idx on public.api_keys (api_client_id);

create table public.webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  api_client_id uuid not null references public.api_clients(id) on delete cascade,
  target_url text not null,
  event_types text[] not null,
  signing_secret_hash text not null,
  signing_secret_preview text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index webhook_subscriptions_client_idx on public.webhook_subscriptions (api_client_id);

create table public.webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.webhook_subscriptions(id) on delete cascade,
  event_type text not null,
  subject_id text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'delivered', 'failed', 'blocked')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  delivered_at timestamptz
);

create index webhook_deliveries_subscription_created_idx on public.webhook_deliveries (subscription_id, created_at desc);
create index webhook_deliveries_status_idx on public.webhook_deliveries (status, created_at);

create table public.api_audit_events (
  id uuid primary key default gen_random_uuid(),
  api_client_id uuid references public.api_clients(id) on delete set null,
  event_type text not null,
  subject_type text,
  subject_id text,
  status text not null default 'allowed' check (status in ('allowed', 'blocked', 'rate_limited')),
  request_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index api_audit_events_client_created_idx on public.api_audit_events (api_client_id, created_at desc);

alter table public.api_clients enable row level security;
alter table public.api_keys enable row level security;
alter table public.webhook_subscriptions enable row level security;
alter table public.webhook_deliveries enable row level security;
alter table public.api_audit_events enable row level security;
