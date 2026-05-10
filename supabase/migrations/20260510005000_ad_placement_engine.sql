create type public.ad_campaign_status as enum (
  'draft',
  'pending_policy',
  'active',
  'paused',
  'completed',
  'blocked'
);

create table public.ad_placements (
  id uuid primary key default gen_random_uuid(),
  placement_key text not null unique,
  name text not null,
  surface text not null,
  description text,
  requires_disclosure boolean not null default true,
  default_disclosure_label text not null default 'Sponsored',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid references public.providers(id) on delete set null,
  name text not null,
  status public.ad_campaign_status not null default 'draft',
  starts_at timestamptz,
  ends_at timestamptz,
  budget_cents integer not null default 0 check (budget_cents >= 0),
  targeting_rules jsonb not null default '{}'::jsonb,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  ad_campaign_id uuid not null references public.ad_campaigns(id) on delete cascade,
  placement_id uuid not null references public.ad_placements(id) on delete cascade,
  headline text not null,
  body text,
  image_url text,
  destination_url text,
  disclosure_label text not null default 'Sponsored',
  creative_payload jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.ad_impressions (
  id uuid primary key default gen_random_uuid(),
  ad_creative_id uuid references public.ad_creatives(id) on delete set null,
  placement_key text not null,
  request_id text,
  user_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ad_clicks (
  id uuid primary key default gen_random_uuid(),
  ad_creative_id uuid references public.ad_creatives(id) on delete set null,
  placement_key text not null,
  request_id text,
  destination_url text,
  user_context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.ad_placements enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.ad_creatives enable row level security;
alter table public.ad_impressions enable row level security;
alter table public.ad_clicks enable row level security;

create policy "Public can read active ad placements"
  on public.ad_placements for select
  using (is_active = true);

create policy "Public can read active ad creatives"
  on public.ad_creatives for select
  using (
    is_active = true
    and exists (
      select 1 from public.ad_campaigns c
      where c.id = ad_creatives.ad_campaign_id
        and c.status = 'active'
    )
  );

create policy "Public can record ad impressions"
  on public.ad_impressions for insert
  with check (true);

create policy "Public can record ad clicks"
  on public.ad_clicks for insert
  with check (true);

insert into public.ad_placements (placement_key, name, surface, description) values
  ('web.discover.top', 'Discover top sponsored slot', 'web', 'Top native sponsored placement on directory search.'),
  ('app.feed.inline', 'App feed inline sponsored slot', 'mobile', 'Inline sponsored placement in the mobile feed.'),
  ('events.featured.local', 'Local featured event slot', 'web_mobile', 'Featured event placement for local event promotion.')
on conflict (placement_key) do nothing;

