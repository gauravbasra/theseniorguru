create table if not exists public.review_moderation_cases (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  previous_status public.review_status not null,
  new_status public.review_status not null,
  reason text not null,
  notes text,
  actor_id text,
  policy_decision text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.review_sentiment (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete cascade,
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  score numeric not null check (score >= 0 and score <= 1),
  themes text[] not null default '{}',
  summary text not null,
  created_at timestamptz not null default now()
);

create index if not exists review_moderation_cases_review_idx
  on public.review_moderation_cases (review_id, created_at desc);

create index if not exists review_sentiment_provider_idx
  on public.review_sentiment (provider_id, created_at desc);

alter table public.review_moderation_cases enable row level security;
alter table public.review_sentiment enable row level security;
