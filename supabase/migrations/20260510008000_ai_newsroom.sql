create type public.news_item_status as enum (
  'new',
  'triaged',
  'assigned',
  'drafted',
  'ignored',
  'blocked_by_policy'
);

create type public.article_status as enum (
  'draft',
  'pending_review',
  'approved',
  'published',
  'blocked_by_policy'
);

create table public.content_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_type text not null check (source_type in ('rss', 'manual_url', 'interview', 'regulatory', 'platform_data')),
  url text,
  review_status public.source_review_status not null default 'pending',
  copyright_notes text,
  created_at timestamptz not null default now()
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  content_source_id uuid references public.content_sources(id) on delete set null,
  status public.news_item_status not null default 'new',
  title text not null,
  source_url text,
  source_name text,
  summary text,
  audience text[] not null default '{}',
  topic_tags text[] not null default '{}',
  published_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.published_articles (
  id uuid primary key default gen_random_uuid(),
  news_item_id uuid references public.news_items(id) on delete set null,
  status public.article_status not null default 'draft',
  byline text not null,
  title text not null,
  slug text not null unique,
  dek text,
  body text not null,
  source_links jsonb not null default '[]'::jsonb,
  ai_assisted boolean not null default true,
  approval_payload jsonb not null default '{}'::jsonb,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.article_derivatives (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.published_articles(id) on delete cascade,
  derivative_type text not null check (derivative_type in ('social_post', 'newsletter_blurb', 'podcast_brief', 'app_feed_post')),
  channel text not null,
  title text,
  body text,
  payload jsonb not null default '{}'::jsonb,
  policy_check_id uuid references public.policy_checks(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.content_sources enable row level security;
alter table public.news_items enable row level security;
alter table public.published_articles enable row level security;
alter table public.article_derivatives enable row level security;

create policy "Public can read published articles"
  on public.published_articles for select
  using (status = 'published');

