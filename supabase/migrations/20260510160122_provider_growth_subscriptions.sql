create type public.growth_subscription_status as enum (
  'draft',
  'pending_contract',
  'active',
  'past_due',
  'canceled',
  'expired',
  'blocked_by_policy'
);

create table public.growth_plans (
  id uuid primary key default gen_random_uuid(),
  plan_key text not null unique,
  name text not null,
  description text,
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  default_term_months integer not null default 3 check (default_term_months in (3, 6, 12)),
  feature_flags text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.provider_growth_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  growth_plan_id uuid not null references public.growth_plans(id) on delete restrict,
  status public.growth_subscription_status not null default 'draft',
  term_months integer not null check (term_months in (3, 6, 12)),
  monthly_price_cents integer not null default 0 check (monthly_price_cents >= 0),
  auto_renews boolean not null default true,
  contract_payload jsonb not null default '{}'::jsonb,
  starts_at timestamptz,
  ends_at timestamptz,
  activated_at timestamptz,
  canceled_at timestamptz,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index provider_growth_subscriptions_provider_idx on public.provider_growth_subscriptions (provider_id, status);

create table public.provider_feature_entitlements (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  subscription_id uuid references public.provider_growth_subscriptions(id) on delete cascade,
  feature_key text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'revoked')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider_id, subscription_id, feature_key)
);

create index provider_feature_entitlements_provider_idx on public.provider_feature_entitlements (provider_id, status);

alter table public.growth_plans enable row level security;
alter table public.provider_growth_subscriptions enable row level security;
alter table public.provider_feature_entitlements enable row level security;

create policy "Public can read active growth plans"
  on public.growth_plans for select
  using (is_active = true);

insert into public.growth_plans (plan_key, name, description, monthly_price_cents, default_term_months, feature_flags) values
  ('growth_starter', 'Growth Starter', 'Campaigns, AI social, local SEO briefs, and baseline chat upgrades.', 10000, 3, array['campaigns', 'ai_social', 'ai_seo', 'enhanced_chat']),
  ('reputation_plus', 'Reputation Plus', 'Review response drafts, review campaign workflows, and reputation monitoring.', 10000, 3, array['reviews', 'review_responses', 'review_campaigns']),
  ('community_events', 'Community Events', 'Sponsored event promotion, RSVP analytics, and local community placements.', 15000, 3, array['event_promotions', 'event_analytics', 'community_placements']),
  ('growth_pro', 'Growth Pro', 'Bundled growth engine with campaigns, SEO, social, reviews, events, and AI assistant features.', 25000, 6, array['campaigns', 'ai_social', 'ai_seo', 'enhanced_chat', 'reviews', 'event_promotions', 'provider_dashboard'])
on conflict (plan_key) do nothing;
