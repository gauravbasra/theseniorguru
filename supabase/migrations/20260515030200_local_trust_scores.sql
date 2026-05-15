create table public.local_trust_scores (
  id uuid primary key default gen_random_uuid(),
  city text,
  state text,
  score integer not null check (score between 0 and 100),
  rating text not null check (rating in ('strong', 'developing', 'needs_review')),
  signal_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index local_trust_scores_scope_created_idx
  on public.local_trust_scores (city, state, created_at desc);

alter table public.local_trust_scores enable row level security;

create policy "Public can read local trust score snapshots"
  on public.local_trust_scores for select
  using (true);
