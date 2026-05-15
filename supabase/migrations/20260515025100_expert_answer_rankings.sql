create table public.expert_answer_rankings (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  city text,
  state text,
  topic_key text,
  ranking_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index expert_answer_rankings_scope_created_idx
  on public.expert_answer_rankings (topic_key, city, state, created_at desc);

alter table public.expert_answer_rankings enable row level security;

create policy "Public cannot read expert answer rankings"
  on public.expert_answer_rankings for select
  using (false);
