create type public.marketing_campaign_status as enum (
  'draft',
  'generated',
  'pending_approval',
  'approved',
  'published',
  'paused',
  'completed',
  'blocked_by_policy'
);

create type public.marketing_campaign_type as enum (
  'profile_growth',
  'event_promotion',
  'review_request',
  'local_seo',
  'social_media',
  'ai_chat',
  'ai_voice',
  'newsletter',
  'sponsored_content'
);

create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  campaign_type public.marketing_campaign_type not null,
  status public.marketing_campaign_status not null default 'draft',
  name text not null,
  objective text,
  audience jsonb not null default '{}'::jsonb,
  channels text[] not null default '{}',
  starts_at timestamptz,
  ends_at timestamptz,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.campaign_assets (
  id uuid primary key default gen_random_uuid(),
  marketing_campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  asset_type text not null,
  channel text not null,
  title text,
  body text,
  asset_payload jsonb not null default '{}'::jsonb,
  approval_status text not null default 'draft' check (approval_status in ('draft', 'approved', 'rejected', 'blocked')),
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  marketing_campaign_id uuid not null references public.marketing_campaigns(id) on delete cascade,
  metric_key text not null,
  metric_value numeric not null default 0,
  metric_payload jsonb not null default '{}'::jsonb,
  recorded_at timestamptz not null default now()
);

alter table public.marketing_campaigns enable row level security;
alter table public.campaign_assets enable row level security;
alter table public.campaign_metrics enable row level security;

