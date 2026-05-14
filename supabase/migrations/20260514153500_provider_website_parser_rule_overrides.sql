create table if not exists public.provider_website_parser_rule_overrides (
  id uuid primary key default gen_random_uuid(),
  data_source_id uuid not null references public.data_sources(id) on delete cascade,
  min_confidence numeric(3,2) not null default 0.55 check (min_confidence >= 0.35 and min_confidence <= 0.95),
  min_content_characters integer not null default 220 check (min_content_characters >= 90 and min_content_characters <= 2000),
  service_keywords text[] not null default '{}',
  conversion_keywords text[] not null default '{}',
  pricing_keywords text[] not null default '{}',
  status text not null default 'active' check (status in ('active', 'inactive')),
  approved_by text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (data_source_id)
);

alter table public.provider_website_parser_rule_overrides enable row level security;

create index if not exists provider_website_parser_rule_overrides_source_idx
  on public.provider_website_parser_rule_overrides (data_source_id, status);
