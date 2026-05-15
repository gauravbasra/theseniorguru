create table if not exists public.reputation_scores (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  score integer not null check (score >= 0 and score <= 100),
  rating text not null check (rating in ('strong', 'developing', 'at_risk')),
  published_reviews integer not null default 0 check (published_reviews >= 0),
  average_rating numeric(3,2) check (average_rating is null or (average_rating >= 0 and average_rating <= 5)),
  average_sentiment_score numeric(4,3) check (
    average_sentiment_score is null or (average_sentiment_score >= 0 and average_sentiment_score <= 1)
  ),
  external_connected_sources integer not null default 0 check (external_connected_sources >= 0),
  trend_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reputation_scores_provider_created_idx
  on public.reputation_scores (provider_id, created_at desc);

alter table public.reputation_scores enable row level security;
