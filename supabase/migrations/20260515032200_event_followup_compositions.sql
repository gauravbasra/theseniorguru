create table public.event_followup_compositions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  tone text not null default 'warm' check (tone in ('warm', 'professional', 'concise')),
  call_to_action text not null default 'review' check (call_to_action in ('review', 'schedule_tour', 'ask_question')),
  subject text not null,
  body text not null,
  merge_fields jsonb not null default '{}'::jsonb,
  recommended_segments text[] not null default '{}',
  composition_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index event_followup_compositions_event_created_idx
  on public.event_followup_compositions (event_id, created_at desc);

alter table public.event_followup_compositions enable row level security;

create policy "Public cannot read event followup compositions"
  on public.event_followup_compositions for select
  using (false);
